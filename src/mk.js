var mk;

(function () {

    mk = {};

    mk.config = {
        IMAGES: 'images/',
        ARENAS: 'arenas/',
        FIGHTERS: 'fighters/',
        STEP_DURATION: 80 
    };


    mk.controller = {};

    mk.controller.Game = function (options) {
        this.fighters = [];

        var current;
        for (var i = 0; i < options.fighters.length; i += 1) {
            current = options.fighters[i];
            if (!mk.fighters[current.name]) {
                throw 'The fighter ' + current + ' does not exists!';
            }
            this.fighters.push(new mk.fighters[current.name](this.arena));
        }
   
        var a = options.arena; 
        this.arena = new mk.arenas.Arena({
            fighters: this.fighters,
            arena: a.arena,
            width: a.width,
            height: a.height,
            container: a.container
        });
    };

    mk.controller.Game.prototype.init = function () {
        var current = 0,
            total = this.fighters.length,
            self = this,
            f;
        for (var i = 0; i < this.fighters.length; i += 1) {
            f = this.fighters[i];
            f.init(function () {
                f.setMove(mk.moves.types.STAND);
                current += 1;
                if (current === total) {
                    self.arena.init();
                    self._setFighersArena();
                }
            });
        }

    };

    mk.controller.Game.prototype._setFighersArena = function () {
        var f;
        for (var i = 0; i < this.fighters.length; i += 1) {
            f = this.fighters[i];
            f.arena = this.arena;
        }
    };

    mk.start = function (options) {
        mk.game = new mk.controller.Game(options);
        mk.game.init();
    };


    mk.arenas = {
        types: {
            TOWER: 0
        }
    };

    mk.arenas.Arena = function (options) {
        this.width = options.width;
        this.height = options.height;
        this.arena = options.arena;
        this.fighters = options.fighters;
        this._container = options.container;
    }

    mk.arenas.Arena.prototype.init = function () {
        var canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        this._container.appendChild(canvas);
        this._context = canvas.getContext('2d');
        this._canvas = canvas;
        this.refresh();
    };

    mk.arenas.Arena.prototype._drawArena = function () {
        var img = document.createElement('img'),
            conf = mk.config,
            self = this;
        if (this.texture) {
            this._context.drawImage(this.texture, 0, 0, this.width, this.height);
        } else {
            img.src = conf.IMAGES + conf.ARENAS + this.arena + '/arena.png';
            img.width = this.width;
            img.height = this.height;
            img.onload = function () {
                self.texture = img;
                self._context.drawImage(img, 0, 0, self.width, self.height);
            };
        }
    };

    mk.arenas.Arena.prototype.refresh = function () {
        this._drawArena();
        var f;
        for (var i = 0; i < this.fighters.length; i += 1) {
            f = this.fighters[i];
            this._context.drawImage(f.getState(), f.getX(), f.getY());
        }
    };

    mk.moves = {};

    mk.moves.types = {
        STAND: 'stand',
        WALK: 'walking',
        WALK_BACKWARD: 'walking-backward',
        SQUAT: 'squating',
        STAND_UP: 'stand-up'
    };









    mk.moves.Move = function (owner, type, stepDuration) {
        this.owner = owner;
        this.type = type;
        this._stepDuration = stepDuration;
        this._interval = -1;
        this._currentStep = 0;
    };

    mk.moves.Move.prototype.go = function () {
        var self = this;
        this._currentStep = 0;
        this._nextStep(this._action); 
        this._interval = setInterval(function () {
           self._nextStep(self._action); 
        }, this._stepDuration);
    };

    mk.moves.Move.prototype._action = function () {
        throw 'Not implemented for ' + this.type;
    };

    mk.moves.Move.prototype._nextStep = function (callback) {
        var img = document.createElement('img'),
            conf = mk.config,
            img;

        img = this._steps[this._currentStep];
        this.owner.setState(img);
        callback.apply(this);
        this._moveNextStep();
    };

    mk.moves.Move.prototype.init = function (callback) {
        this._steps = [];
        var conf = mk.config,
            loaded = 0,
            self = this,
            img;
        for (var i = 0; i < this._totalSteps; i += 1) {
            img = document.createElement('img'); 
            img.onload = function () {
                loaded += 1;
                if (loaded === self._totalSteps) {
                    callback.apply(self);
                }
            };
            img.src = conf.IMAGES +
                      conf.FIGHTERS +
                      this.owner.type + '/' +
                      this.type + '/' +
                      i + '.png';
            this._steps.push(img);
        }
        if (typeof this.addHandlers === 'function') {
            this.addHandlers();
        }
    };

    mk.moves.Move.prototype.stop = function () {
        clearInterval(this._interval);
    };





    mk.moves.Stand = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.STAND, 80);
        this._totalSteps = 10;
    };

    mk.moves.Stand.prototype = new mk.moves.Move();

    mk.moves.Stand.prototype._action = function () {
        this.owner.refresh();
    };

    mk.moves.Stand.prototype._moveNextStep = function () {
        this._currentStep += 1;
        this._currentStep = this._currentStep % this._totalSteps;
    };





    mk.moves.Walk = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.WALK, 80);
        this._totalSteps = 9;
    };

    mk.moves.Walk.prototype = new mk.moves.Move();

    mk.moves.Walk.prototype.addHandlers = function () {
        var self = this;
        document.addEventListener('keydown', function (e) {
            if (e.keyCode === 39) {
                self.owner.setMove(mk.moves.types.WALK);
            }
        }, false);
        document.addEventListener('keyup', function (e) {
            if (e.keyCode === 39) {
                self.owner.setMove(mk.moves.types.STAND);
            }
        }, false);
    };

    mk.moves.Walk.prototype._action = function () {
        this.owner.setX(this.owner.getX() + 10);
        this.owner.refresh();
    };

    mk.moves.Walk.prototype._moveNextStep = function () {
        this._currentStep += 1;
        this._currentStep = this._currentStep % this._totalSteps;
    };





    mk.moves.WalkBack = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.WALK_BACKWARD, 80);
        this._totalSteps = 9;
    };

    mk.moves.WalkBack.prototype = new mk.moves.Move();

    mk.moves.WalkBack.prototype._moveNextStep = function () {
        this._currentStep += 1;
        this._currentStep = this._currentStep % this._totalSteps();
    };

    mk.moves.WalkBack.prototype.addHandlers = function () {
        var self = this;
        document.addEventListener('keydown', function (e) {
            if (e.keyCode === 37) {
                self.owner.setMove(mk.moves.types.WALK_BACKWARD);
            }
        }, false);
        document.addEventListener('keyup', function (e) {
            if (e.keyCode === 37) {
                self.owner.setMove(mk.moves.types.STAND);
            }
        }, false);
    };

    mk.moves.WalkBack.prototype._action = function () {
        this.owner.setX(this.owner.getX() - 10);
        this.owner.refresh();
    };

    mk.moves.WalkBack.prototype._moveNextStep = function () {
        this._currentStep += 1;
        this._currentStep = this._currentStep % this._totalSteps;
    };



    mk.moves.Squat = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.SQUAT, 80);
        this._totalSteps = 3;
        this._locked = false;
    };

    mk.moves.Squat.prototype = new mk.moves.Move();

    mk.moves.Squat.prototype._moveNextStep = function () {
        this._currentStep += 1;
        if (this._currentStep >= 2) {
            this._currentStep = 2;
        } else {
            this._currentStep = this._currentStep + 1;
        }
    };

    mk.moves.Squat.prototype.addHandlers = function () {
        var self = this;
        document.addEventListener('keydown', function (e) {
            if (e.keyCode === 40) {
                self.owner.setMove(mk.moves.types.SQUAT);
            }
        }, false);
        document.addEventListener('keyup', function (e) {
            if (e.keyCode === 40) {
                self._locked = false;
                self.owner.setMove(mk.moves.types.STAND_UP);
            }
        }, false);
    };

    mk.moves.Squat.prototype._action = function () {
        if (!this._locked && this._currentStep <= 2) {
            if (this._currentStep === 0) {
                this.owner.setY(this.owner.getY() + 14);
            }
            if (this._currentStep === 2) {
                this.owner.setY(this.owner.getY() + 48);
                this._locked = true;
            }
        }
        this.owner.refresh();
    };





    mk.moves.StandUp = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.STAND_UP, 80);
        this._totalSteps = 3;
    };

    mk.moves.StandUp.prototype = new mk.moves.Move();

    mk.moves.StandUp.prototype._moveNextStep = function () {
        if (this._currentStep >= 2) {
            this._currentStep = 2;
        } else {
            this._currentStep = this._currentStep + 1;
        }
    };

    mk.moves.StandUp.prototype._action = function () {
        if (this._currentStep <= 2) {
            if (this._currentStep === 1) {
                this.owner.setY(this.owner.getY() - 26);
            }
            if (this._currentStep === 2) {
                this.owner.setY(this.owner.getY() - 36);
                this.stop();
                this.owner.setMove(mk.moves.types.STAND);
            }
        }
        this.owner.refresh();
    };


    mk.fighters = {
        types: {
            SUBZERO: 'subzero'
        }
    };

    mk.fighters.Fighter = function (arena) {
        this.arena = arena;
        this._position = {
            x: 50,
            y: 220 
        };
    };

    mk.fighters.Fighter.prototype.init = function (callback) {
        this.moves = {};
        this.moves[mk.moves.types.STAND] = new mk.moves.Stand(this);
        this.moves[mk.moves.types.WALK] = new mk.moves.Walk(this);
        this.moves[mk.moves.types.WALK_BACKWARD] = new mk.moves.WalkBack(this);
        this.moves[mk.moves.types.SQUAT] = new mk.moves.Squat(this);
        this.moves[mk.moves.types.STAND_UP] = new mk.moves.StandUp(this);
        var self = this,
            initialized = 0,
            total = Object.keys(this.moves).length;

        for (var move in this.moves) {
            this.moves[move].init(function () {
                initialized += 1;
                if (initialized === total) {
                    if (typeof callback === 'function') {
                        callback();
                    }
                }
            });
        }
    };

    mk.fighters.Fighter.prototype.refresh = function () {
        if (this.arena && typeof this.arena.refresh === 'function') {
            this.arena.refresh(this);
        }
    };

    mk.fighters.Fighter.prototype.getX = function () {
        return this._position.x;
    };

    mk.fighters.Fighter.prototype.getY = function () {
        return this._position.y;
    };

    mk.fighters.Fighter.prototype.setX = function (x) {
        this._position.x = x;
    };

    mk.fighters.Fighter.prototype.setY = function (y) {
        this._position.y = y;
    };

    mk.fighters.Fighter.prototype.setState = function (state) {
        this._currentState = state;
    };

    mk.fighters.Fighter.prototype.getState = function () {
        return this._currentState;
    };

    mk.fighters.Fighter.prototype.setMove = function (move) {
        if (!(move in this.moves))
            throw 'This player does not have the move - ' + move;

        if (this._currentMove && this._currentMove.type === move)
            return;

        if (this._currentMove && typeof this._currentMove.stop === 'function')
            this._currentMove.stop();

        this._currentMove = this.moves[move];
        this._currentMove.go();
    };






    mk.fighters.Subzero = function (arena) {
        mk.fighters.Fighter.call(this, arena);
        this.type = 'subzero';
        this.init();
    };

    mk.fighters.Subzero.prototype = new mk.fighters.Fighter();

}());
