'use strict';

var async = require("async");
var config = require('config-path')();
var engine = require('engine.io');
var errorhandler = require("errorhandler");
var express = require("express");
var fs = require("fs");
var http = require("http");
var path = require("path");
var util = require("util");

module.exports = function(options, callback) {
	var app = express();

	var publicDir = path.join(__dirname, "public");

	if (options.trustProxy)
		app.enable('trust proxy');

	app.get("/shaders.js", function(req, res, next) {
		var shadersDir = path.join(publicDir, "shaders.js");
		return fs.readdir(shadersDir, function(err, files) {
			if (err) return next(err);

			var shaders = {
				vertex: {},
				fragment: {}
			};

			return async.each(files, function(file, callback) {
				var parts = file.split(".");

				if (parts[1] === 'vsh') {
					return fs.readFile(path.join(shadersDir, file), function(err, data) {
						if (err) return callback(err);

						shaders.vertex[parts[0]] = data.toString();
						return callback();
					});
				} else if (parts[1] === 'fsh') {
					return fs.readFile(path.join(shadersDir, file), function(err, data) {
						if (err) return callback(err);

						shaders.fragment[parts[0]] = data.toString();
						return callback();
					});
				} else
					return callback();
			}, function(err) {
				if (err) return next(err);

				res.type('js');
				res.send(util.format("var shaderSources = %j;", shaders));
			});
		});
	});

	app.use(express.static(publicDir));

	app.use(errorhandler());

	var httpServer = http.createServer(app);

	var server = engine.attach(httpServer);

	var master;
	var started = false;
	var startTime = 0;
	var finishedClients = [];

	function forEachClient(iterator) {
		return Object.keys(server.clients).forEach(function(id) {
			var client = server.clients[id];
			if (client)
				return iterator(client);
		});
	}

	function send(socket, args) {
		return socket.send(JSON.stringify(args));
	}

	function broadcast(args, except) {
		var message = JSON.stringify(args);

		forEachClient(function(socket) {
			if (socket !== except) {
				socket.send(message);
			}
		});
	}

	setInterval(function() {
		forEachClient(function(socket) {
			if (socket.entered)
				broadcast(['score', socket.id, socket.score]);
		});
	}, config.updateInterval * 1000);

	server.on('connection', function(socket) {
		var isMaster = false;
		socket.entered = false;
		socket.score = 0;
		socket.finished = false;

		send(socket, ['id', socket.id]);

		forEachClient(function(other) {
			if (other.entered) {
				send(socket, ['player', other.id, other.name, other.hues, other.score]);
			}
		});

		var mustSendStart = started;

		socket.on('data', function(message) {
			try {
				message = JSON.parse(message);
			} catch (err) {
				console.warn(message);
				return console.error(err);
			}

			switch (message[0]) {
				case 'auth':
					if (message[1] === config.masterPassword) {
						isMaster = true;
						master = socket;
						send(socket, ['master']);

						if (started)
							send(socket, ['start', startTime]);

					}
					break;

				case 'event':
					if (isMaster)
						broadcast(['event', message[1], Date.now() + 3000]);
					break;

				case 'finish':
					if (started && !socket.finished) {
						socket.finished = true;
						finishedClients.push(socket);
					}
					break;

				case 'player':
					socket.name = message[1].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
					socket.hues = message[2];
					socket.entered = true;
					broadcast(['player', socket.id, socket.name, socket.hues, socket.score]);
					break;

				case 'ping':
					send(socket, ['pong', Date.now()]);
					if (mustSendStart) {
						mustSendStart = false;
						send(socket, ['start', startTime]);
					}
					break;

				case 'score':
					if (Date.now() >= startTime)
						socket.score = message[1];
					break;

				case 'start':
					if (isMaster) {
						finishedClients = [];
						started = true;
						startTime = Date.now() + 5000;
						forEachClient(function(socket) {
							socket.score = 0;
						});
						broadcast(['start', startTime]);
					}
					break;

				case 'summary':
					if (isMaster) {
						finishedClients = finishedClients.concat(Object.keys(server.clients)
							.map(function(id) {
								return server.clients[id];
							})
							.filter(function(socket) {
								if (socket && socket.entered && !socket.finished) {
									socket.finished = true;
									return true;
								}
							})
							.sort(function(a, b) {
								return b.score - a.score;
							}));
						var winners = finishedClients.slice(0, 3).map(function(client) {
							return [client.name, client.hues];
						});
						console.log(winners);
						broadcast(['summary', winners]);
						send(socket, ['participants', finishedClients.length]);
						finishedClients.forEach(function(client, i) {
							send(client, ['rank', i, finishedClients.length]);
						});

						var json = JSON.stringify(finishedClients.map(function(client) {
							return [client.name, client.hues];
						}));
						fs.writeFile(Date.now() + '.log', json);
					}
					break;

				default:
					console.log('unknown', message);
					break;
			}
		});

		socket.on('close', function() {
			broadcast(['disconnected', socket.id], socket);
		});
	});

	return callback(null, httpServer, app);
};

if (require.main === module) {
	module.exports(config, function(err, server, app) {
		if (err) throw err;

		var port = process.env.PORT || config.port;
		server.listen(port, function(){
			console.log("Server listening on port %d in mode %s", port, app.get('env'));
		});
	});
}
