function Sprite(spriteData) {
    this.pixels = spriteData.pixels.map(function(row) {
        return row.split('').map(function(char) {
            return parseInt(char);
        });
    });
    this.anchor = spriteData.anchor;
}

Sprite.prototype.draw = function(ctx, x, y, palette) {
    ctx.save();
    ctx.translate(x - this.anchor[0], y - this.anchor[1]);
    for (var i = 0; i < this.pixels.length; ++i) {
        var row = this.pixels[i];
        for (var j = 0; j < row.length; ++j) {
            var colorIndex = row[j];
            if (!isNaN(colorIndex)) {
                ctx.fillStyle = palette.colors[colorIndex];
                ctx.fillRect(j, i, 1, 1);
            }
        }
    }
    ctx.restore();
};
