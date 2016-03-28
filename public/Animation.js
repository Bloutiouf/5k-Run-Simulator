function Animation(animationData) {
    this.sprites = animationData.sprites.map(function(spriteName) {
        return sprites[spriteName];
    });
    this.length = this.sprites.length;
    this.index = animationData.index || 0;
    this.interval = animationData.interval || data.defaultAnimationInterval;
}

Animation.prototype.draw = function(ctx, x, y, index, palette) {
    return this.sprites[index].draw(ctx, x, y, palette);
};
