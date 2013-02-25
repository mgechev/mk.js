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

    mk.controllers = {};

    mk.controllers.Base = function (options) {
        if (!options)
            return;
        this.fighters = [];
        this._opponents = {};
        this._callbacks = options.callbacks || {};

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

    mk.controllers.Base.prototype.getOpponent = function (f) {
        return this._opponents[f.getName(name)];
    };

    mk.controllers.Base.prototype.init = function (promise) {
        var current = 0,
            total = this.fighters.length,
            self = this,
            f;
        this._initialize();
        for (var i = 0; i < this.fighters.length; i += 1) {
            f = this.fighters[i];
            (function (f) {
                f.init(function () {
                    f.setMove(mk.moves.types.STAND);
                    current += 1;
                    if (current === total) {
                        self.arena.init();
                        self._setFighersArena();
                        promise._initialized();
                    }
                });
            }(f));
        }
    };

    mk.controllers.Base.prototype._initialize = function () {
        throw '_initialize is not implemented for this controller!';
    };

    mk.controllers.Base.prototype._setFighersArena = function () {
        var f;
        for (var i = 0; i < this.fighters.length; i += 1) {
            f = this.fighters[i];
            f.setArena(this.arena);
        }
        f.setX(450);    //testing
    };

    mk.controllers.Base.prototype.fighterAttacked = function (fighter, damage) {
        var opponent = this.getOpponent(fighter),
            opponentLife = opponent.getLife(),
            callback = this._callbacks[mk.callbacks.ATTACK];
        if (Math.abs(opponent.getX() - fighter.getX()) <= fighter.getWidth()) {
            opponent.endureAttack(damage);
            if (typeof callback === 'function') {
                callback.call(null, fighter, opponent, opponentLife - opponent.getLife());
            }
        }
    };

    mk.controllers.Base.prototype.fighterDead = function (fighter) {
        var opponent = this.getOpponent(fighter),
            callback = this._callbacks[mk.callbacks.GAME_END];
        opponent.getMove().stop();
        opponent.setMove(mk.moves.types.WIN);
        if (typeof callback === 'function') {
            callback.call(null, fighter);
        }
    };

    mk.controllers.keys = {
        RIGHT: 39,
        LEFT: 37,
        UP: 38,
        DOWN: 40,
        A: 65,
        S: 83,
        D: 68,
        F: 70
    };

    mk.controllers.Basic = function (options) {
        mk.controllers.Base.call(this, options);
    };

    mk.controllers.Basic.prototype = new mk.controllers.Base();

    mk.controllers.Basic.prototype._initialize = function () {
        this._player = 0;
        this._addHandlers();
    };

    mk.controllers.Basic.prototype._addHandlers = function () {
        var pressed = {},
            self = this,
            f = this.fighters[this._player];
        document.addEventListener('keydown', function (e) {
            pressed[e.keyCode] = true;
            var move = self._getMove(pressed);
            self._moveFighter(f, move);
        }, false);
        document.addEventListener('keyup', function (e) {
            delete pressed[e.keyCode];
            var move = self._getMove(pressed);
            self._moveFighter(f, move);
        }, false);
    };

    mk.controllers.Basic.prototype._moveFighter = function (f, m) {
        if (m) {
            f.setMove(m);
        }
    };

    mk.controllers.Basic.prototype._getMove = function (pressed) {
        var k = mk.controllers.keys,
            m = mk.moves.types,
            f = this.fighters[this._player],
            self = this;


        if (f.getMove().type === m.SQUAT && !pressed[k.DOWN]) {
            f.getMove().stop(function () {
                self._moveFighter(f, m.STAND_UP);
            });
        }

        if (Object.keys(pressed).length === 0) { 
            return m.STAND;
        }

        if (pressed[k.LEFT]) {
            if (f.place === 0) {
                return m.WALK;
            } else {
                if (pressed[k.UP]) {
                    return m.BACKWARD_JUMP;
                }
                return m.WALK_BACKWARD;
            }
        } else if (pressed[k.RIGHT]) {
            if (f.place === 0) {
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

    mk.controllers.Network = function (options) {
        mk.controllers.Basic.call(this, options);
        this._isHost = options.isHost;
        this._gameName = options.gameName;
    };

    mk.controllers.Network.prototype = new mk.controllers.Basic();

    mk.controllers.Network.prototype.Requests = {
        CREATE_GAME: 'create-game',
        JOIN_GAME: 'join-game'
    };

    mk.controllers.Network.prototype.Responses = {
        SUCCESS: 0,
        GAME_EXISTS: 1,
        GAME_NOT_EXISTS: 2,
        GAME_FULL: 3
    };

    mk.controllers.Network.prototype._createGame = function (game) {
        this._socket.emit(this.Requests.CREATE_GAME, this._gameName);
        this._addSocketHandlers();
    };

    mk.controllers.Network.prototype._addSocketHandlers = function () {
        var opponent = this.fighters[+!this._player];
        this._socket.on('event', function (move) {
            if (move === mk.moves.types.STAND_UP) {
                opponent.unlock();
            }
            opponent.setMove(move);
        });
    };

    mk.controllers.Network.prototype._moveFighter = function (f, m) {
        if (m) {
            this._socket.emit('event', m);
            f.setMove(m);
        }
    };

    mk.controllers.Network.prototype._joinGame = function (game) {
        this._socket.emit(this.Requests.JOIN_GAME, this._gameName);
        this._addSocketHandlers();
    };

    mk.controllers.Network.prototype._initialize = function () {
        var self = this;
        if (this._isHost) {
            this._player = 1;
        } else {
            this._player = 0;
        }
        this._addHandlers();
        this._socket = io.connect(),
        this._socket.on('connect', function () {
            if (self._isHost) {
                self._createGame(self._gameName);
            } else {
                self._joinGame(self._gameName);
            }
        });
        this._socket.on('response', function (response) {
            if (response !== self.Responses.SUCCESS) {
                alert('Error!');
            }
        });
    };

    mk.start = function (options) {
        var type = options.gameType || 'basic',
            promise = new mk.Promise();
        type = type.toLowerCase();
        switch (type) {
            case 'basic':
                mk.game = new mk.controllers.Basic(options);
                break;
            case 'network':
                mk.game = new mk.controllers.Network(options);
                break;
            default:
                mk.game = new mk.controllers.Basic(options);
        }
        mk.game.init(promise);
        return promise;
    };

    mk.Promise = function () {
        this.callbacks = [];
    };

    mk.Promise.prototype._initialized = function () {
        this.callbacks.forEach(function (c) {
            if (typeof c === 'function') {
                c();
            }
        });
    };

    mk.Promise.prototype.ready = function (callback) {
        this.callbacks.push(callback);
    };


    mk.arenas = {
        types: {
            TOWER: 0
        }
    };

    mk.arenas.Arena = function (options) {
        this.width = options.width || 600;
        this.height = options.height || 400;
        this.arena = options.arena || mk.arenas.types.TOWER;
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
        WIN: 'win',
        ENDURE: 'endure',
        SQUAT_ENDURE: 'squat-endure'
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
        this._stepDuration = stepDuration || 80;
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

    mk.moves.Move.prototype._action = function () {};

    mk.moves.Move.prototype._nextStep = function (callback) {
        var img = document.createElement('img'),
            conf = mk.config,
            img;

        img = this._steps[this.owner.getOrientation()][this._currentStep];
        this.owner.setState(img);
        callback.apply(this);
        this.owner.refresh();
        this._moveNextStep();
    };

    mk.moves.Move.prototype.init = function (callback) {
        var loaded = 0,
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
                img.src = this._getImageUrl(i, o[orientation]);
                this._steps[o[orientation]].push(img);
            }
        }
        if (typeof this.addHandlers === 'function') {
            this.addHandlers();
        }
    };

    mk.moves.Move.prototype._getImageUrl = function (id, ownerOrientation) {
        var conf = mk.config;
        return conf.IMAGES +
               conf.FIGHTERS +
               this.owner.getName() + '/' +
               ownerOrientation + '/' +
               this.type + '/' +
               id + '.png';
    };

    mk.moves.Move.prototype.stop = function (callback) {
        if (this._locked) {
            this._shouldStop = true;
            if (typeof callback === 'function') {
                this._actionPending = callback;
            }
            return;
        }

        if (typeof this._beforeStop === 'function')
            this._beforeStop();

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

    mk.moves.CycleMove = function (options) {
        options = options || {};
        mk.moves.Move.call(this, options.owner, options.type, options.duration);
        this._totalSteps = options.steps;
    };

    mk.moves.CycleMove.prototype = new mk.moves.Move();

    mk.moves.CycleMove.prototype._moveNextStep = function () {
        this._currentStep += 1;
        this._currentStep = this._currentStep % this._totalSteps;
    };

    mk.moves.Stand = function (owner) {
        mk.moves.CycleMove.call(this, {
            owner: owner,
            type: mk.moves.types.STAND,
            steps: 9
        });
    };

    mk.moves.Stand.prototype = new mk.moves.CycleMove();

    mk.moves.Walk = function (owner) {
        mk.moves.CycleMove.call(this, {
            owner: owner,
            type: mk.moves.types.WALK,
            steps: 9
        });
    };

    mk.moves.Walk.prototype = new mk.moves.CycleMove();

    mk.moves.Walk.prototype._action = function () {
        this.owner.setX(this.owner.getX() + 10);
    };

    mk.moves.WalkBack = function (owner) {
        mk.moves.CycleMove.call(this, {
            owner: owner,
            type: mk.moves.types.WALK_BACKWARD,
            steps: 9
        });
    };

    mk.moves.WalkBack.prototype = new mk.moves.CycleMove();

    mk.moves.WalkBack.prototype._action = function () {
        this.owner.setX(this.owner.getX() - 10);
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
    };

    mk.moves.Win = function (owner) {
        mk.moves.FreezeMove.call(this, owner, mk.moves.types.WIN, 100);
        this._totalSteps = 10;
    };

    mk.moves.Win.prototype = new mk.moves.FreezeMove();

    mk.moves.Win.prototype._action = function () {
        this.keepDistance();
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
    };

    mk.moves.Endure = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.ENDURE);
        this._totalSteps = 3;
    };

    mk.moves.Endure.prototype = new mk.moves.Move();

    mk.moves.Endure.prototype._action = function () {
        if (this._currentStep === this._totalSteps - 1) {
            this.stop();
            this.owner.setMove(mk.moves.types.STAND);
        }
    };

    mk.moves.Endure.prototype._beforeGo = function () {
        this.owner.lock();
    };

    mk.moves.Endure.prototype._beforeStop = function () {
        this.owner.unlock();
    };

    mk.moves.Endure.prototype._moveNextStep = function () {
        this._currentStep += 1;
    };


    mk.moves.SquatEndure = function (owner) {
        mk.moves.Move.call(this, owner, mk.moves.types.SQUAT_ENDURE);
        this._totalSteps = 3;
    };

    mk.moves.SquatEndure.prototype = new mk.moves.Move();

    mk.moves.SquatEndure.prototype._action = function () {
        if (this._currentStep === this._totalSteps - 1) {
            this.stop();
            this.owner.setMove(mk.moves.types.SQUAT);
        }
        this.keepDistance();
    };

    mk.moves.SquatEndure.prototype._beforeGo = function () {
        this.owner.lock();
        if (this._bottom === undefined)
            this._bottom = this.owner.getBottom();
    };

    mk.moves.SquatEndure.prototype._beforeStop = function () {
        this.owner.unlock();
    };

    mk.moves.SquatEndure.prototype._moveNextStep = function () {
        this._currentStep += 1;
    };

    mk.moves.SquatEndure.prototype.keepDistance = function () {
        var currentBottom = this.owner.getBottom();
        if (currentBottom > this._bottom) {
            this.owner.setY(this.owner.getY() + currentBottom - this._bottom);
        }
        if (currentBottom < this._bottom) {
            this.owner.setY(this.owner.getY() - (this._bottom - currentBottom));
        }
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
    };

    mk.moves.Jump.prototype._beforeStop = function () {
        this.owner.unlock();
    };

    mk.moves.Jump.prototype._beforeGo = function () {
        this._moveBack = false;
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
    };

/* * * * * * * * * * * * * * Standard attacks * * * * * * * * * * * * * * * */

    mk.moves.Attack = function (options) {
        options = options || {};
        mk.moves.Move.call(this, options.owner, options.type, 40);
        this._damage = options.damage;
        this._totalSteps = options.steps;
        this._moveBack = false;
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
    };

    mk.moves.Attack.prototype.getDamage = function () {
        return this._damage;
    };

    mk.moves.Attack.prototype._beforeStop = function () {
        this.owner.unlock();
    };

    mk.moves.Attack.prototype._beforeGo = function () {
        this._moveBack = false;
        this._hitPassed = false;
        this.owner.lock();
    };

    mk.moves.HighKick = function (owner) {
        mk.moves.Attack.call(this, {
            owner: owner,
            type: mk.moves.types.HIGH_KICK,
            steps: 7,
            damage: 10
        });
    };

    mk.moves.HighKick.prototype = new mk.moves.Attack();


    mk.moves.LowKick = function (owner) {
        mk.moves.Attack.call(this, {
            owner: owner,
            type: mk.moves.types.LOW_KICK,
            steps: 6,
            damage: 6
        });
    };

    mk.moves.LowKick.prototype = new mk.moves.Attack();

    mk.moves.LowPunch = function (owner) {
        mk.moves.Attack.call(this, {
            owner: owner,
            type: mk.moves.types.LOW_PUNCH,
            steps: 5,
            damage: 5
        });
    };

    mk.moves.LowPunch.prototype = new mk.moves.Attack();
    

    mk.moves.HighPunch = function (owner) {
        mk.moves.Attack.call(this, {
            owner: owner,
            type: mk.moves.types.HIGH_PUNCH,
            steps: 5,
            damage: 8
        });
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
        this.moves[mk.moves.types.ENDURE] = new mk.moves.Endure(this);
        this.moves[mk.moves.types.SQUAT_ENDURE] = new mk.moves.SquatEndure(this);
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
            this._game.fighterDead(this);
            this.unlock();
            this.setMove(mk.moves.types.FALL);
        } else {
            if (this.getMove().type === mk.moves.types.SQUAT) {
                this.unlock();
                this.setMove(mk.moves.types.SQUAT_ENDURE);
            } else {
                this.setMove(mk.moves.types.ENDURE);
            }
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
