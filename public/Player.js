function Player(id, name, hues, score) {
    this.id = id;
    this.name = name;
    this.palette = new Palette(hues);
    this.score = new PFloat(score, PFloat.EXP, 1);
    this.y = new PFloat(0, PFloat.EXP, 5);

    this.element = document.createElement('div');
    this.element.innerHTML = this.name;
    document.getElementById('names').appendChild(this.element);
}

Player.prototype.setAnimation = function(animation) {
    if (this.animation !== animation) {
        this.animation = animation;
        this.index = 0;
        this.countdown = animation.interval;
    }
};

Player.prototype.update = function(dt) {
    this.score.update(dt);
    this.y.update(dt);

    this.setAnimation(this.score.target - this.score.current > 0.5 ? animations.running : animations.idle);

    this.countdown -= dt;
    while (this.countdown <= 0) {
        this.index = (this.index + 1) % this.animation.length;
        this.countdown += this.animation.interval;
    }
};

Player.prototype.draw = function(ctx) {
    if (this.animation)
        this.animation.draw(ctx, this.score.current, this.y.current, this.index, this.palette);

    setStyleVendor(this.element, 'transform', 'translate(' + ((this.score.current - centerX.current) * scale + width / 2 - 20) + 'px, ' + ((this.y.current - centerY.current) * scale + height / 2 + 10) + 'px)');
};

Player.prototype.remove = function(ctx) {
    this.element.remove();
};
