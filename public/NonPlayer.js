function NonPlayer(x, y, animation, hues, name) {
    this.palette = new Palette(hues);
    this.x = x;
    this.y = y;
    this.setAnimation(animation);

    if (name) {
        this.element = document.createElement('div');
        this.element.innerHTML = name;
        document.getElementById('names').appendChild(this.element);
    }
}

NonPlayer.prototype.setAnimation = function(animation) {
    this.animation = animation;
    this.index = 0;
    this.countdown = animation.interval;
};

NonPlayer.prototype.update = function(dt) {
    this.countdown -= dt;
    while (this.countdown <= 0) {
        this.index = (this.index + 1) % this.animation.length;
        this.countdown += this.animation.interval;
    }
};

NonPlayer.prototype.draw = function(ctx) {
    this.animation.draw(ctx, this.x, this.y, this.index, this.palette);

    if (this.element)
        setStyleVendor(this.element, 'transform', 'translate(' + ((this.x - centerX.current) * scale + width / 2 - 20) + 'px, ' + ((this.y - centerY.current) * scale + height / 2 + 10) + 'px)');
};
