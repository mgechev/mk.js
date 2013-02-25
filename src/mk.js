var mk;

(function () {

    mk = {};

    mk.callbacks = {
        ATTACK: 'attack',
        GAME_END: 'game-end'
    };

    mk.config = {
        IMAGES: 'images/',
        ARENAS: 'arenas/',
        FIGHTERS: 'fighters/',
        STEP_DURATION: 80 
    };

    mk.controller = {};

    mk.controller.Game = function (options) {
        this.fighters = [];
        this._opponents = {};
        this._callbacks = options.callbacks;

        var current;
        for (var i = 0; i < options.fighters.length; i += 1) {
            current = options.fighters[i];
            var orientation = (i === 0) ?
                              mk.fighters.orientations.LEFT :
                              mk.fighters.orientations.RIGHT;
            this.fighters.push(new mk.fighters.Fighter({
                name: current.name,
                arena: this.arena,
                orientation: orientation,
                game: this
            }));
        }

        this._opponents[this.fighters[0].getName()] = this.fighters[1];
        this._opponents[this.fighters[1].getName()] = this.fighters[0];
   
        var a = options.arena; 
        this.arena = new mk.arenas.Arena({
            fighters: this.fighters,
            arena: a.arena,
            width: a.width,
            height: a.height,
            container: a.container,
            game: this
        });
    };

    mk.controller.Game.prototype.getOpponent = function (f) {
        return this._opponents[f.getName(name)];
    };

    mk.controller.Game.prototype.init = function () {
        var current = 0,
            total = this.fighters.length,
            self = this,
            f;
        this._addHandlers();
        for (var i = 0; i < this.fighters.length; i += 1) {
            f = this.fighters[i];
            (function (f) {
                f.init(function () {
                    f.setMove(mk.moves.types.STAND);
                    current += 1;
                    if (current === total) {
                        self.arena.init();
                        self._setFighersArena();
                    }
                });
            }(f));
        }
    };

    mk.controller.Game.prototype._setFighersArena = function () {
        var f;
        for (var i = 0; i < this.fighters.length; i += 1) {
            f = this.fighters[i];
            f.setArena(this.arena);
        }
        f.setX(300);    //testing
    };

    mk.controller.Game.prototype.fighterAttacked = function (fighter, damage) {
        var opponent = this.getOpponent(fighter),
            opponentLife = opponent.getLife(),
            callback = this._callbacks[mk.callbacks.ATTACK];
        if (opponent.getX() - fighter.getX() <= fighter.getWidth()) {
            opponent.endureAttack(damage);
            if (typeof callback === 'function') {
                callback.call(null, fighter, opponent, opponentLife - opponent.getLife());
            }
        }
    };

    mk.controller.Game.prototype.fighterDead = function (fighter) {
        var opponent = this.getOpponent(fighter),
            callback = this._callbacks[mk.callbacks.GAME_END];
        opponent.getMove().stop();
        opponent.setMove(mk.moves.types.WIN);
        if (typeof callback === 'function') {
            callback.call(null, fighter);
        }
    };

    mk.controller.keys = {
        RIGHT: 39,
        LEFT: 37,
        UP: 38,
        DOWN: 40,
        A: 65,
        S: 83,
        D: 68,
        F: 70
    };

    mk.controller.Game.prototype._addHandlers = function () {
        var pressed = {},
            self = this,
            f1 = this.fighters[0];
        document.addEventListener('keydown', function (e) {
            pressed[e.keyCode] = true;
            var move = self._getMove(pressed);
            if (move) {
                f1.setMove(move);
            }

        }, false);
        document.addEventListener('keyup', function (e) {
            delete pressed[e.keyCode];
            var move = self._getMove(pressed);
            if (move) {
                f1.setMove(move);
            }
        }, false);
    };

    mk.controller.Game.prototype._getMove = function (pressed) {
        var k = mk.controller.keys,
            m = mk.moves.types,
            f1 = this.fighters[0];


        if (f1.getMove().type === m.SQUAT && !pressed[k.DOWN]) {
            f1.getMove().stop(function () {
                f1.setMove(m.STAND_UP);
            });
        }

        if (Object.keys(pressed).length === 0) { 
            return m.STAND;
        }

        if (pressed[k.LEFT]) {
            if (f1.place === 0) {
                return m.WALK;
            } else {
                if (pressed[k.UP]) {
                    return m.BACKWARD_JUMP;
                }
                return m.WALK_BACKWARD;
            }
        } else if (pressed[k.RIGHT]) {
            if (f1.place === 0) {
                return m.WALK_BACKWARD;
            } else {
                if (pressed[k.UP]) {
                    return m.FORWARD_JUMP;
                }
                return m.WALK;
            }
        } else if (pressed[k.DOWN]) {
            return m.SQUAT;
        } else if (pressed[k.F]) {
            return m.HIGH_KICK;
        } else if (pressed[k.UP]) {
            return m.JUMP;
        } else if (pressed[k.D]) {
            return m.LOW_KICK;
        } else if (pressed[k.S]) {
            return m.LOW_PUNCH;
        } else if (pressed[k.A]) {
            return m.HIGH_PUNCH;
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
        this._game = options.game;
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

    mk.arenas.Arena.prototype.moveFighter = function (fighter, pos) {
        var opponent = this._game.getOpponent(fighter),
            op = { x: opponent.getX(), y: opponent.getY() };
        if (pos.x <= 0) {
            pos.x = 0;
        }
        if (pos.x >= this.width - fighter.getWidth()) {
            pos.x = this.width - fighter.getWidth();
        }
  
        if (pos.x + fighter.getWidth() > op.x &&
            pos.x < op.x + opponent.getWidth()) {
            if (pos.y + fighter.getHeight() >= op.y) {
                pos = this._synchronizeFighters(pos, fighter, opponent);
            }
        }

        this._setFightersOrientation(fighter, opponent);
        return pos;
    };

    mk.arenas.Arena.prototype._synchronizeFighters = function (pos, fighter, opponent) {
        if (fighter.getMove().type === mk.moves.types.FORWARD_JUMP ||
            fighter.getMove().type === mk.moves.types.BACKWARD_JUMP) {
            pos.x = fighter.getX();
            return pos;
        }
        if (opponent.getOrientation() === mk.fighters.orientations.RIGHT) {
            var diff = Math.min(this.width -
                               (opponent.getX() + opponent.getWidth() +
                               fighter.getWidth()),
                               pos.x - fighter.getX());
            if (diff > 0) {
                pos.x = fighter.getX() + diff;
                opponent.setX(opponent.getX() + diff);
            } else {
                pos.x = fighter.getX() + diff;
            }
        } else {
            var diff = Math.min(opponent.getX(), fighter.getX() - pos.x);
            if (diff > 0) {
                pos.x = fighter.getX() - diff;
                opponent.setX(opponent.getX() - diff);
                if (opponent.getX() + opponent.getWidth() > pos.x) {
                    pos.x = opponent.getX() + opponent.getWidth();
                }
            } else {
                pos.x = fighter.getX();
                if (opponent.getX() + opponent.getWidth() > pos.x) {
                    pos.x = opponent.getX() + opponent.getWidth();
                }
            }
        }
        return pos;
    };

    mk.arenas.Arena.prototype._setFightersOrientation = function (f1, f2) {
        if (f1.getX() < f2.getX()) {
            f1.setOrientation(mk.fighters.orientations.LEFT);
            f2.setOrientation(mk.fighters.orientations.RIGHT);
        } else {
            f1.setOrientation(mk.fighters.orientations.RIGHT);
            f2.setOrientation(mk.fighters.orientations.LEFT);
        }
    };


/* * * * * * * * * * * * * * * * Definition of all movements * * * * * * * * * * * * * * * */

    mk.moves = {};

    mk.moves.types = {
        STAND: 'stand',
        WALK: 'walking',
        WALK_BACKWARD: 'walking-backward',
        SQUAT: 'squating',
        STAND_UP: 'stand-up',
        HIGH_KICK: 'high-kick',
        JUMP: 'jumping',
        FORWARD_JUMP: 'forward-jump',
        BACKWARD_JUMP: 'backward-jump',
        LOW_KICK: 'low-kick',
        LOW_PUNCH: 'low-punch',
        HIGH_PUNCH: 'high-punch',
        FALL: 'fall',
        WIN: 'win'
    };

    /**
     * Base constructor for all movements
     *
     * @constructor
     * @param {Fighter} owner Owner of the movement
     * @param {string} type Type of the movement
     * @param {number} stepDuration Duration between the movements steps
     */
    mk.moves.Move = function (owner, type, stepDuration) {
        this.owner = owner;
        this.type = type;
        this._stepDuration = stepDuration;
        this._interval = -1;
        this._currentStep = 0;
        this._locked = false;
        this._actionPending = [];
    };

    mk.moves.Move.prototype.go = function () {
        var self = this;
        if (typeof this._beforeGo === 'function')
            this._beforeGo();
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

        img = this._steps[this.owner.getOrientation()][this._currentStep];
        this.owner.setState(img);
        callback.apply(this);
        this._moveNextStep();
    };

    mk.moves.Move.prototype.init = function (callback) {
        var conf = mk.config,
            loaded = 0,
            self = this,
            img, o = mk.fighters.orientations;
        this._steps = {};
        this._steps[o.RIGHT] = [];
        this._steps[o.LEFT] = [];
        for (var i = 0; i < this._totalSteps; i += 1) {
            for (var orientation in o) {
                img = document.createElement('img'); 
                img.onload = function () {
                    loaded += 1;
                    if (loaded === self._totalSteps * 2) {
                        callback.apply(self);
                    }
                };
                img.src = conf.IMAGES +
                          conf.FIGHTERS +
                          this.owner.getName() + '/' +
                          o[orientation] + '/' +
                          this.type + '/' +
                          i + '.png';
                this._steps[o[orientation]].push(img);
            }
        }
        if (typeof this.addHandlers === 'function') {
            this.addHandlers();
        }
    };

    mk.moves.Move.prototype.stop = function (callback) {
        if (this._locked) {
            this._shouldStop = true;
            if (typeof callback === 'function') {
                this._actionPending = callback;
            }
            return;
        }

        if (typeof this._beforeStop === 'function') {
            this._beforeStop();
        }

        clearInterval(this._interval);

        if (typeof this._actionPending === 'function') {
            var func = this._actionPending;
            this._actionPending = null;
            func();
        }

        this._shouldStop = false;
    };


    mk.moves.Move.prototype.lock = function () {
        this._locked = true;
    };

    mk.moves.Move.prototype.unlock = function () {
        this._locked = false;
    };

    mk.moves.Stand = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.STAND, 80);
        this._totalSteps = 9;
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

    mk.moves.WalkBack.prototype._action = function () {
        this.owner.setX(this.owner.getX() - 10);
        this.owner.refresh();
    };

    mk.moves.WalkBack.prototype._moveNextStep = function () {
        this._currentStep += 1;
        this._currentStep = this._currentStep % this._totalSteps;
    };

    mk.moves.FreezeMove = function (owner, type, duration) {
        mk.moves.Move.call(this, owner, type, duration);
        this._freeze = false;
        this._bottom;
    };

    mk.moves.FreezeMove.prototype = new mk.moves.Move();

    mk.moves.FreezeMove.prototype._moveNextStep = function () {
        if (this._currentStep >= this._totalSteps - 1) {
            this._currentStep = this._totalSteps - 1;
        } else {
            this._currentStep = this._currentStep + 1;
        }
    };

    mk.moves.FreezeMove.prototype._beforeGo = function () {
        this.lock();
        this.owner.lock();
        this._bottom = this.owner.getBottom();
    };

    mk.moves.FreezeMove.prototype._beforeStop = function () {
        this._freeze = false;
        this.owner.unlock();
    };

    mk.moves.FreezeMove.prototype.keepDistance = function () {
        var currentBottom = this.owner.getBottom();
        if (currentBottom > this._bottom) {
            this.owner.setY(this.owner.getY() + currentBottom - this._bottom);
        }
        if (currentBottom < this._bottom) {
            this.owner.setY(this.owner.getY() - (this._bottom - currentBottom));
        }
    };

    mk.moves.Fall = function (owner) {
        mk.moves.FreezeMove.call(this, owner, mk.moves.types.FALL, 100);
        this._totalSteps = 7;
    };

    mk.moves.Fall.prototype = new mk.moves.FreezeMove();

    mk.moves.Fall.prototype._action = function () {
        this.keepDistance();
        this.owner.refresh();
    };

    mk.moves.Win = function (owner) {
        mk.moves.FreezeMove.call(this, owner, mk.moves.types.WIN, 100);
        this._totalSteps = 10;
    };

    mk.moves.Win.prototype = new mk.moves.FreezeMove();

    mk.moves.Win.prototype._action = function () {
        this.keepDistance();
        this.owner.refresh();
    };

    mk.moves.Squat = function (owner) {
        mk.moves.FreezeMove.call(this, owner, mk.moves.types.SQUAT, 80);
        this._totalSteps = 3;
    };

    mk.moves.Squat.prototype = new mk.moves.FreezeMove();

    mk.moves.Squat.prototype._action = function () {
        this.keepDistance();
        if (!this._freeze && this._currentStep <= 2) {
            if (this._currentStep === 2) {
                this._freeze = true;
            }
        }
        if (this._currentStep === 2 && this._shouldStop) {
            this.unlock();
            this.stop();
        }
        this.owner.refresh();
    };

    mk.moves.StandUp = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.STAND_UP, 100);
        this._totalSteps = 3;
    };

    mk.moves.StandUp.prototype = new mk.moves.FreezeMove();

    mk.moves.StandUp.prototype._action = function () {
        if (this._currentStep <= 2) {
            if (this._currentStep === 2) {
                this.unlock();
                this.stop();
                this.owner.setMove(mk.moves.types.STAND);
            }
        }
        this.keepDistance();
        this.owner.refresh();
    };

    mk.moves.Jump = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.JUMP, 60);
        this._totalSteps = 6;
        this._moveBack = false;
    };

    mk.moves.Jump.prototype = new mk.moves.Move();

    mk.moves.Jump.prototype._moveNextStep = function () {
        if (!this._moveBack) {
            this._currentStep += 1;
        }
        if (this._moveBack) {
            this._currentStep -= 1;
            if (this._currentStep <= 0) {
                this.stop();
                this.owner.setMove(mk.moves.types.STAND);
            }
        }
        if (this._currentStep >= this._totalSteps) {
            this._moveBack = true;
            this._currentStep -= 1;
        }
    };

    mk.moves.Jump.prototype._action = function () {
        if (!this._moveBack) {
            if (this._currentStep === 0) {
                this.owner.setY(this.owner.getY() + 20);
            } else {
                this.owner.setY(this.owner.getY() - 20);
            }
        } else {
            if (this._currentStep === this._totalSteps - 1) {
                this.owner.setY(this.owner.getY() - 20);
            } else {
                this.owner.setY(this.owner.getY() + 25);
            }
        }
        this.owner.refresh();
    };

    mk.moves.Jump.prototype._beforeStop = function () {
        this.owner.unlock();
    };

    mk.moves.Jump.prototype._beforeGo = function () {
        this._moveBack = false;
        this._currentStep = 0;
        this.owner.lock();
    };

    mk.moves.ForwardJump = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.FORWARD_JUMP, 80);
        this._totalSteps = 8;
        this._ownerHeight = owner.getHeight();
    };

    mk.moves.ForwardJump.prototype = new mk.moves.Move();

    mk.moves.ForwardJump.prototype._beforeStop = function () {
        this.owner.unlock();
        this.owner.setHeight(this._ownerHeight);
    };

    mk.moves.ForwardJump.prototype._beforeGo = function () {
        this._currentStep = 0;
        this.owner.lock();
        this.owner.setHeight(this._ownerHeight / 2);
    };

    mk.moves.ForwardJump.prototype._moveNextStep = function () {
        this._currentStep += 1;
        if (this._currentStep >= this._totalSteps) {
            this.stop();
            this.owner.setMove(mk.moves.types.STAND);
        }
    };

    mk.moves.ForwardJump.prototype._action = function () {
        if (this._currentStep > (this._totalSteps - 1) / 2) { //Move down
            this.owner.setY(this.owner.getY() + 26);
            this.owner.setX(this.owner.getX() + 23);
        } else { //Move up
            this.owner.setY(this.owner.getY() - 26);
            this.owner.setX(this.owner.getX() + 23);
        }
        this.owner.refresh();
    };

    mk.moves.BackwardJump = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.BACKWARD_JUMP, 80);
        this._totalSteps = 8;
        this._ownerHeight = owner.getHeight();
    };

    mk.moves.BackwardJump.prototype = new mk.moves.Move();

    mk.moves.BackwardJump.prototype._beforeStop = function () {
        this.owner.unlock();
        this.owner.setHeight(this._ownerHeight);
    };

    mk.moves.BackwardJump.prototype._beforeGo = function () {
        this._currentStep = 0;
        this.owner.lock();
        this.owner.setHeight(this._ownerHeight / 2);
    };

    mk.moves.BackwardJump.prototype._moveNextStep = function () {
        this._currentStep += 1;
        if (this._currentStep >= this._totalSteps) {
            this.stop();
            this.owner.setMove(mk.moves.types.STAND);
        }
    };

    mk.moves.BackwardJump.prototype._action = function () {
        if (this._currentStep > (this._totalSteps - 1) / 2) { //Move down
            this.owner.setY(this.owner.getY() + 26);
            this.owner.setX(this.owner.getX() - 23);
        } else { //Move up
            this.owner.setY(this.owner.getY() - 26);
            this.owner.setX(this.owner.getX() - 23);
        }
        this.owner.refresh();
    };

/* * * * * * * * * * * * * * Standard attacks * * * * * * * * * * * * * * * */

    mk.moves.Attack = function (owner, type, steps) {
        mk.moves.Move.call(this, owner, type, 50);
        this._totalSteps = steps;
        this._moveBack = false;
        this._damage = 2;
        this._hitPassed = false;
    }

    mk.moves.Attack.prototype = new mk.moves.Move();

    mk.moves.Attack.prototype._moveNextStep = function () {
        if (!this._moveBack) {
            this._currentStep += 1;
        }
        if (this._moveBack) {
            this._currentStep -= 1;
            if (this._currentStep <= 0) {
                this.stop();
                this.owner.setMove(mk.moves.types.STAND);
            }
        }
        if (this._currentStep >= this._totalSteps) {
            this._moveBack = true;
            this._currentStep -= 1;
        }
    };

    mk.moves.Attack.prototype._action = function () {
        if (!this._hitPassed &&
            this._currentStep === Math.round(this._totalSteps / 2)) {
            this.owner.attack(this.getDamage());
            this._hitPassed = true;
        }
        this.owner.refresh();
    };

    mk.moves.Attack.prototype.getDamage = function () {
        return this._damage;
    };

    mk.moves.Attack.prototype._beforeStop = function () {
        this.owner.unlock();
    };

    mk.moves.Attack.prototype._beforeGo = function () {
        this._moveBack = false;
        this._currentStep = 0;
        this._hitPassed = false;
        this.owner.lock();
    };

    mk.moves.HighKick = function (owner) {
        mk.moves.Attack.call(this, owner, mk.moves.types.HIGH_KICK, 7);
        this._damage = 10;
    };

    mk.moves.HighKick.prototype = new mk.moves.Attack();


    mk.moves.LowKick = function (owner) {
        mk.moves.Attack.call(this, owner, mk.moves.types.LOW_KICK, 6);
        this._damage = 6;
    };

    mk.moves.LowKick.prototype = new mk.moves.Attack();

    mk.moves.LowPunch = function (owner) {
        mk.moves.Attack.call(this, owner, mk.moves.types.LOW_PUNCH, 5);
        this._damage = 5;
    };

    mk.moves.LowPunch.prototype = new mk.moves.Attack();
    

    mk.moves.HighPunch = function (owner) {
        mk.moves.Attack.call(this, owner, mk.moves.types.HIGH_PUNCH, 5);
        this._damage = 8;
    };

    mk.moves.HighPunch.prototype = new mk.moves.Attack();


/* * * * * * * * * * * * * * End of the standard attacks * * * * * * * * * * * * * * * */

/* * * * * * * * * * * * * End of the movements definition * * * * * * * * * * * * * * */



    mk.fighters = {};

    mk.fighters.list = {
        'subzero': true,
        'kano': true
    };

    mk.fighters.orientations = {
        LEFT: 'left',
        RIGHT: 'right'
    };

    mk.fighters.Fighter = function (options) {
        var name = options.name.toLowerCase();
        if (!mk.fighters.list[name]) {
            throw 'Invalid fighter name!';
        }
        this._name = name;
        this._arena = options.arena;
        this._game = options.game;
        this._life = 100;
        this._orientation = options.orientation;
        this._width = 40;
        this._height = 60;
        this._locked = false;
        this._position = {
            x: 50,
            y: 220 
        };
        this.init();
    };

    mk.fighters.Fighter.prototype.init = function (callback) {
        this.moves = {};
        this.moves[mk.moves.types.STAND] = new mk.moves.Stand(this);
        this.moves[mk.moves.types.WALK] = new mk.moves.Walk(this);
        this.moves[mk.moves.types.WALK_BACKWARD] = new mk.moves.WalkBack(this);
        this.moves[mk.moves.types.SQUAT] = new mk.moves.Squat(this);
        this.moves[mk.moves.types.STAND_UP] = new mk.moves.StandUp(this);
        this.moves[mk.moves.types.HIGH_KICK] = new mk.moves.HighKick(this);
        this.moves[mk.moves.types.LOW_KICK] = new mk.moves.LowKick(this);
        this.moves[mk.moves.types.LOW_PUNCH] = new mk.moves.LowPunch(this);
        this.moves[mk.moves.types.HIGH_PUNCH] = new mk.moves.HighPunch(this);
        this.moves[mk.moves.types.FALL] = new mk.moves.Fall(this);
        this.moves[mk.moves.types.WIN] = new mk.moves.Win(this);
        this.moves[mk.moves.types.JUMP] = new mk.moves.Jump(this);
        this.moves[mk.moves.types.FORWARD_JUMP] = new mk.moves.ForwardJump(this);
        this.moves[mk.moves.types.BACKWARD_JUMP] = new mk.moves.BackwardJump(this);

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

    mk.fighters.Fighter.prototype.getName = function () {
        return this._name;
    };

    mk.fighters.Fighter.prototype.setArena = function (arena) {
        this._arena = arena;
    };

    mk.fighters.Fighter.prototype.getWidth = function () {
        return this._width;
    };

    mk.fighters.Fighter.prototype.getHeight = function () {
        return this._height;
    };

    mk.fighters.Fighter.prototype.setWidth = function (height) {
        this._height = height;
    };

    mk.fighters.Fighter.prototype.setHeight = function (width) {
        this._width = width;
    };

    mk.fighters.Fighter.prototype.setOrientation = function (orientation) {
        this._orientation = orientation;
    };

    mk.fighters.Fighter.prototype.getOrientation = function (orientation) {
        return this._orientation;
    };

    mk.fighters.Fighter.prototype.refresh = function () {
        if (this._arena && typeof this._arena.refresh === 'function') {
            this._arena.refresh(this);
        }
    };

    mk.fighters.Fighter.prototype.getX = function () {
        return this._position.x;
    };

    mk.fighters.Fighter.prototype.lock = function () {
        this._locked = true;
    };

    mk.fighters.Fighter.prototype.unlock = function () {
        this._locked = false;
    };

    mk.fighters.Fighter.prototype.getY = function () {
        return this._position.y;
    };

    mk.fighters.Fighter.prototype.setX = function (x) {
        this._position.x = this._arena.moveFighter(this, { x: x, y: this.getY() }).x;
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

    mk.fighters.Fighter.prototype.attack = function (damage) {
        this._game.fighterAttacked(this, damage);
    };

    mk.fighters.Fighter.prototype.endureAttack = function (damage) {
        if (this.getMove().type === mk.moves.types.BLOCK) {
            damage /= 2;
        }
        this.setLife(this.getLife() - damage);
        if (this.getLife() === 0) {
            this.setMove(mk.moves.types.FALL);
            this._game.fighterDead(this);
        }
        return this.getLife();
    };

    mk.fighters.Fighter.prototype.setLife = function (life) {
        this._life = Math.max(life, 0);
    };

    mk.fighters.Fighter.prototype.getLife = function () {
        return this._life;
    };

    mk.fighters.Fighter.prototype.getBottom = function () {
        var bottomY = this._currentState.height + this.getY();
        return this._arena.height - bottomY;
    };

    mk.fighters.Fighter.prototype.setMove = function (move) {
        if (this._locked)
            return;

        if (!(move in this.moves))
            throw 'This player does not have the move - ' + move;

        if (this._currentMove && this._currentMove.type === move)
            return;

        if (this._currentMove && typeof this._currentMove.stop === 'function')
            this._currentMove.stop();

        this._currentMove = this.moves[move];
        this._currentMove.go();
    };

    mk.fighters.Fighter.prototype.getMove = function () {
        return this._currentMove;
    };

}());
