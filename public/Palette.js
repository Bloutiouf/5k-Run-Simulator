function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return 'rgb(' + Math.floor(255*r) + ',' +
        Math.floor(255*g) + ',' +
        Math.floor(255*b) + ')';
}

function Palette(hues) {
    this.hues = hues || [];
    while (this.hues.length < data.palette.hues) {
        this.hues.push(Math.random());
    }
    this.updateColors();
}

Palette.prototype.updateColors = function() {
    this.colors = this.hues.map(function(hue) {
        return HSVtoRGB(hue, data.palette.s, data.palette.v);
    });
};

Palette.prototype.changeHue = function(index, hue) {
    this.hues[index] = (hue % 1);
    return this.updateColors();
};
