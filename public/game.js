
var sprites = {};
Object.keys(data.sprites).forEach(function(spriteName) {
    sprites[spriteName] = new Sprite(data.sprites[spriteName]);
});

var animations = {};
Object.keys(data.animations).forEach(function(animationName) {
    animations[animationName] = new Animation(data.animations[animationName]);
});

var Stages = {
    home: 0,
    game: 1,
    summary: 2,
};

var Steps = {
    init: 0,
    left: 1,
    right: 2,
};

var Events = {
    bier: 0,
    trex: 1,
};

var currentStage;
var currentStep;

var scale;
var pixelsOnScreen = new PFloat(0, PFloat.EXP, 5);
var centerX = new PFloat(0, PFloat.EXP, 5);
var centerY = new PFloat(0, PFloat.EXP, 5);

var styleVendors = ['webkit', 'moz', 'ms', 'o'];
function setStyleVendor(element, property, value) {
	element.style[property] = value;
	property = property[0].toUpperCase() + property.substr(1);
	styleVendors.forEach(function(prefix) {
		element.style[prefix + property] = value;
	});
}

var width, height;
var nonPlayers;

var namesElement = document.getElementById('names');
var counterElement = document.getElementById("counter");
var rankElement = document.getElementById("rank");
var messageElement = document.getElementById("message");

var podiumHues = [0.061, 0.569, 0.325];
var helpHues = [0.642, 0.078, 0.869];
var bierHues = [0.264, 0.147, 0.831, 0.747];
var trexHues = [0.266, 0.203, 0.222, 0.005];

function requestFullscreen(elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    }
}

function game() {
    'use strict';

    var container, canvas, ctx;

	try {
		container = document.getElementById('game');
		canvas = document.createElement('canvas');
		ctx = canvas.getContext('2d');
	} catch (err) {
		return console.error(err);
	}

	container.appendChild(canvas);

    // ctx.imageSmoothingEnabled = false;
    // ctx.webkitImageSmoothingEnabled = false;
    // ctx.mozImageSmoothingEnabled = false;

	function onWindowResize(event) {
		width = window.innerWidth;
		height = window.innerHeight;

		canvas.width = width;
		canvas.height = height;

		container.style.width = width + "px";
		container.style.height = height + "px";
	}

	window.addEventListener('resize', onWindowResize);
	onWindowResize();

    var socket;
	var pingTime;
	var serverOffset;
	var pingTimeout;

    var ownPlayer;
    var ownPlayerId;
    var playerByIds = {};
    var finished;

    function toLocalTime(time) {
        return time + (serverOffset ? serverOffset.current : 0);
    }

    function updatePlayerY() {
        Object.keys(playerByIds)
            .map(function(id) {
                return playerByIds[id];
            })
            .sort(function(a, b) {
                return b.score.current - a.score.current;
            })
            .forEach(function(player, i) {
                player.y.target = i * 22;
            });
    }

	function send(args) {
		return socket.send(JSON.stringify(args));
	}

	function sendPing() {
		pingTime = Date.now();
		send(['ping']);
	}

    var scoreInterval;
    var started;
    var runStartTime;
    var isMaster;
    var eventNonPlayer;
    var helpNonPlayer;
    var eventTime;
    var slideNonPlayer;
    var music;
    var musicStarted;
	function connect() {
        if (ownPlayer)
            ownPlayer.remove();

        Object.keys(playerByIds)
            .forEach(function(id) {
                var player = playerByIds[id];
                if (player)
                    player.remove();
            });

        currentStage = Stages.home;
        currentStep = Steps.init;
        ownPlayer = null;
        ownPlayerId = null;
        playerByIds = {};
        namesElement.innerHTML = '';
        started = false;
        runStartTime = 0;
        finished = false;
        isMaster = false;
        nonPlayers = [];
        eventTime = 0;
        eventNonPlayer = null;
        helpNonPlayer = null;
        slideNonPlayer = new NonPlayer(0, 0, animations.slide, helpHues);
        namesElement.style.display = 'none';
        homeCharacter = new NonPlayer(0, 10, animations.home);
        music = null;
        musicStarted = false;
        clearInterval(scoreInterval);

		socket = new eio.Socket();

		socket.on('open', function() {
			if (location.hash)
				send(['auth', location.hash.substr(1)]);
			else {
				document.getElementById("name").style.display = 'block';
				document.getElementById("nameInput").focus();
				document.getElementById("name").addEventListener('submit', function(event) {
					event.preventDefault();
					var name = document.getElementById("nameInput").value.trim() || "Anonymous";
					send(['player', name, homeCharacter.palette.hues]);
					document.getElementById("name").style.display = 'none';
                    requestFullscreen(document.body);
				});
				document.getElementById("change-colors").addEventListener('click', function(event) {
					event.preventDefault();
					homeCharacter.palette = new Palette();
				});
                sendPing();
			}
		});

		socket.on('message', function(message) {
			try {
				message = JSON.parse(message);
			} catch (err) {
				console.warn(message);
				return console.error(err);
			}

			// console.log(message);

			switch (message[0]) {
                case 'disconnected':
                    var player = playerByIds[message[1]];
                    if (player) {
                        player.remove();
                        delete playerByIds[message[1]];
                        updatePlayerY();
                    }
                    break;

                case 'event':
                    switch (message[1]) {
                        case Events.bier:
                            eventNonPlayer = new NonPlayer(0, 0, animations.bier, bierHues);
                            break;

                        case Events.trex:
                            eventNonPlayer = new NonPlayer(0, 0, animations.trex, trexHues);
                            break;

                        default:
                            console.error('Unknwon event');
                            break;
                    }
                    eventTime = toLocalTime(message[2]);
                    break;

                case 'id':
                    ownPlayerId = message[1];
                    break;

				case 'master':
					if (!isMaster) {
						isMaster = true;
                        currentStage = Stages.game;
						document.getElementById("message").style.display = 'block';
                        namesElement.style.display = '';
                        helpNonPlayer = new NonPlayer(0, 0, animations.alternate, helpHues);
                        music = new Audio('bh-redux.ogg');
                        music.loop = true;
                        music.load();
					}
					break;

                case 'participants':
                    rankElement.innerHTML = 'Thanks to the ' + message[1] + ' participants!';
                    break;

				case 'player':
					player = new Player(message[1], message[2], message[3], message[4]);
                    playerByIds[player.id] = player;
                    if (player.id === ownPlayerId && currentStage === Stages.home) {
                        ownPlayer = player;
                        currentStage = Stages.game;
                        namesElement.style.display = '';
                        scoreInterval = setInterval(function() {
                            send(['score', ownPlayer.score.target]);
                        }, 200);
                    }
                    updatePlayerY();
					break;

				case 'pong':
					var serverHalfPing = (Date.now() - pingTime) / 2;
                    var offset = Date.now() - serverHalfPing - message[1];
                    if (serverOffset)
                        serverOffset.target = offset;
                    else
                        serverOffset = new PFloat(offset, PFloat.EXP, 1);
					pingTimeout = setTimeout(sendPing, 500);
					break;

                case 'rank':
                    rankElement.innerHTML = 'You finished ' + (message[1] + 1) + ' out of ' + message[2] + ' participants!';
                    break;

                case 'score':
                    player = playerByIds[message[1]];
                    if (player && player.id !== ownPlayerId)
                        player.score.target = message[2];
                    updatePlayerY();
                    break;

                case 'start':
                    helpNonPlayer = null;
                    centerX.set(0);
                    started = true;
                    runStartTime = toLocalTime(message[1]);
                    Object.keys(playerByIds)
                        .forEach(function(id) {
                            var player = playerByIds[id];
                            if (player)
                                player.score.set(0);
                        });
                    break;

                case 'summary':
                    if (currentStage !== Stages.summary) {
                        Object.keys(playerByIds)
                            .forEach(function(id) {
                                playerByIds[id].remove();
                            });

                        currentStage = Stages.summary;
                        var summary = message[1];

                        if (summary.length > 0) {
                            nonPlayers.push(new NonPlayer(0, 0, animations.podium, podiumHues));
                            nonPlayers.push(new NonPlayer(0, -13, animations.first, summary[0][1], summary[0][0]));
                        }

                        if (summary.length > 1)
                            nonPlayers.push(new NonPlayer(-14, -10, animations.second, summary[1][1], summary[1][0]));

                        if (summary.length > 2)
                            nonPlayers.push(new NonPlayer(14, -7, animations.third, summary[2][1], summary[2][0]));
                    }
                    break;

				default:
					console.log('unknown', message);
					break;
			}
		});

		socket.on('close', function() {
			clearTimeout(pingTimeout);
			pingTimeout = null;

			setTimeout(connect, 100);
		});
	}

	var startTime = Date.now();
	var lastTime = 0;
	var time;
	var dt;

    var homeCharacter;

    function isEventHappening() {
        return eventNonPlayer && eventTime <= Date.now();
    }

	function render() {
		requestAnimationFrame(render);

		time = (Date.now() - startTime) / 1000;
		dt = time - lastTime;
		lastTime = time;

        if (serverOffset)
            serverOffset.update(dt);

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);

        switch (currentStage) {
            case Stages.home:
                pixelsOnScreen.set(40);
                centerX.set(0);
                centerY.set(0);
                break;

            case Stages.game:
                if (!isMaster) {
                    pixelsOnScreen.set(100);
                    centerX.target = ownPlayer.score.current;
                    centerY.target = ownPlayer.y.current;
                }
                break;

            case Stages.summary:
                pixelsOnScreen.set(48);
                centerX.set(0);
                centerY.set(-18);
                break;

            default:
                console.error('Unknown stage ' + currentStage);
                break;
        }

        pixelsOnScreen.update(dt);
        centerX.update(dt);
        centerY.update(dt);

        ctx.save();

        var smallest = Math.min(width, height);
        scale = smallest / Math.max(pixelsOnScreen.current, 10);
        ctx.scale(scale, scale);

        ctx.translate(width / scale / 2 - centerX.current, 0);

        if (started && currentStage === Stages.game) {
            ctx.fillStyle = '#ed6515';
            ctx.fillRect(2, 0, 2, height / scale);
            ctx.fillRect(1002, 0, 2, height / scale);
        }

        ctx.translate(0, height / scale / 2 - centerY.current);

        if (!isEventHappening())
            Object.keys(playerByIds)
                .forEach(function(id) {
                    playerByIds[id].update(dt);
                });

        var timeBeforeGo = (runStartTime - Date.now()) * 0.001;
        if (timeBeforeGo <= -3)
            counterElement.innerHTML = '';
        else if (timeBeforeGo <= 0) {
            counterElement.innerHTML = 'GO!';
        } else if (timeBeforeGo <= 1)
            counterElement.innerHTML = '1';
        else if (timeBeforeGo <= 2) {
            counterElement.innerHTML = '2';
            if (isMaster && !musicStarted) {
                musicStarted = true;
                music.play();
            }
        } else if (timeBeforeGo <= 3)
            counterElement.innerHTML = '3';

        switch (currentStage) {
            case Stages.home:
                homeCharacter.update(dt);
                homeCharacter.draw(ctx);
                break;

            case Stages.game:
                Object.keys(playerByIds)
                    .forEach(function(id) {
                        playerByIds[id].draw(ctx);
                    });
                break;

            case Stages.summary:
                nonPlayers.forEach(function(obj) {
                    obj.update(dt);
                    obj.draw(ctx);
                });
                break;

            default:
                console.error('Unknown stage ' + currentStage);
                break;
        }

        ctx.restore();
        ctx.save();

        var helpScale = smallest / 60;
        ctx.translate(width / 2 , height / 2);
        ctx.scale(helpScale, helpScale);

        if (helpNonPlayer) {
            helpNonPlayer.update(dt);
            helpNonPlayer.draw(ctx);
        }

        if (currentStage === Stages.game && isEventHappening()) {
            eventNonPlayer.update(dt);
            eventNonPlayer.draw(ctx);

            slideNonPlayer.update(dt);
            slideNonPlayer.draw(ctx);
        }

        ctx.restore();
    }

    function makeStep() {
        ownPlayer.score.target += 5;
        if (started && !finished && ownPlayer.score.target >= 1000) {
            finished = true;
            send(['finish']);
        }
    }

    addEventListener('keydown', function(event) {
        if (isEventHappening()) {
            if (event.which === 38) {
                eventNonPlayer = null;
            }
        } else if (isMaster) {
            switch (event.which) {
				case 13: // enter
                    if (document.activeElement !== messageElement)
                        event.preventDefault();
					if (event.ctrlKey) {
                        messageElement.blur();
                        messageElement.contentEditable = false;
					} else {
                        messageElement.contentEditable = true;
						messageElement.focus();
                    }
					break;

                case 27: // escape
                    event.preventDefault();
                    send(['summary']);
                    break;

                case 32: // space
                    event.preventDefault();
                    helpNonPlayer = null;
                    send(['start']);
                    break;

                case 66: // b
                    if (started) {
                        send(['event', Events.bier]);
                    }
                    break;

                case 68: // d
                    if (started) {
                        send(['event', Events.trex]);
                    }
                    break;
            }
        } else if (currentStage == Stages.game && Date.now() >= runStartTime) {
            switch (event.which) {
                case 37: // left
                    event.preventDefault();
                    if (ownPlayer && currentStep !== Steps.left) {
                        currentStep = Steps.left;
                        makeStep();
                    }
                    break;

                case 39: // right
                    event.preventDefault();
                    if (ownPlayer && currentStep !== Steps.right) {
                        currentStep = Steps.right;
                        makeStep();
                    }
                    break;

            }
        }
    });

    var touchY;
    addEventListener('touchstart', function(event) {
        if (!ownPlayer || !event.changedTouches || !event.changedTouches.length) return;
        event.preventDefault();
        var touch = event.changedTouches[0];
        if (isEventHappening()) {
            touchY = touch.clientY;
        } else if (Date.now() >= runStartTime) {
            if (touch.clientX < width / 2) {
                if (currentStep !== Steps.left) {
                    currentStep = Steps.left;
                    makeStep();
                }
            } else {
                if (currentStep !== Steps.right) {
                    currentStep = Steps.right;
                    makeStep();
                }
            }
        }
    });

    addEventListener('touchend', function(event) {
        if (!ownPlayer || !event.changedTouches || !event.changedTouches.length) return;
        event.preventDefault();
        var touch = event.changedTouches[0];
        if (isEventHappening()) {
            if (touchY - touch.clientY > 200) {
                eventNonPlayer = null;
            }
        }
        touchY = 0;
    });

    var mouseDown = false;
    var mouseX, mouseY;

	messageElement.addEventListener("mousedown", function(event) {
        event.preventDefault();
		mouseDown = true;
        mouseX = event.clientX;
        mouseY = event.clientY;
	});

	messageElement.addEventListener("mouseup", function(event) {
        event.preventDefault();
        mouseDown = false;
	});

	messageElement.addEventListener("mousemove", function(event) {
        event.preventDefault();
		if (!isMaster || !mouseDown) return;
        centerX.target -= (event.clientX - mouseX) * 0.5;
		centerY.target -= (event.clientY - mouseY) * 0.5;
        mouseX = event.clientX;
        mouseY = event.clientY;
	});

	addEventListener("wheel", function(event) {
        event.preventDefault();
		if (!isMaster) return;
        pixelsOnScreen.target += (event.deltaY > 0 ? 10 : -10);
	}, false);

	connect();
	render();
}

game();
