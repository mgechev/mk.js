;(function () {

  var mk = {};

  mk.callbacks = {
    ATTACK  : 'attack',
    GAME_END: 'game-end'
  };

  mk.config = {
    IMAGES       : 'images/',
    ARENAS       : 'arenas/',
    FIGHTERS     : 'fighters/',
    STEP_DURATION: 80,
    PLAYER_TOP   : 230,
    BLOCK_DAMAGE : 0.2
  };

  mk.controllers = {};

  mk.controllers.Base = function (options) {
    if (!options)
      return;

    this._callbacks = options.callbacks || {};

    this._initializeFighters(options.fighters);

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

  mk.reset = function () {
    var game = this.game;
    if (typeof game.reset === 'function')
        game.reset();
    game.fighters.forEach(function (f) {
      f.getMove().stop();
    });
    game.fighters = null;
    game._opponents = null;
    game.arena.destroy();
    game.arena = null;
    game._callbacks = null;
    this.game = null;
  };

  mk.controllers.Base.prototype._initializeFighters = function (fighters) {
    var current;

    this.fighters = [];
    this._opponents = {};

    for (var i = 0; i < fighters.length; i += 1) {
      current = fighters[i];
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
  };

  mk.controllers.Base.prototype.getOpponent = function (f) {
    return this._opponents[f.getName(name)];
  };

  mk.controllers.Base.prototype.init = function (promise) {
    var current = 0,
      total = this.fighters.length,
      self = this,
      f;
    for (var i = 0; i < this.fighters.length; i += 1) {
      f = this.fighters[i];
      (function (f) {
        f.init(function () {
          f.setMove(mk.moves.types.STAND);
          current += 1;
          if (current === total) {
            self.arena.init();
            self._setFighersArena();
            self._initialize();
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
    f.setX(470);  //testing
  };

  mk.controllers.Base.prototype.fighterAttacked = function (fighter, damage) {
    var opponent = this.getOpponent(fighter),
      opponentLife = opponent.getLife(),
      callback = this._callbacks[mk.callbacks.ATTACK];
    if (this._requiredDistance(fighter, opponent) &&
      this._attackCompatible(fighter.getMove().type, opponent.getMove().type)) {
      opponent.endureAttack(damage, fighter.getMove().type);
      if (typeof callback === 'function') {
        callback.call(null, fighter, opponent, opponentLife - opponent.getLife());
      }
    }
  };

  mk.controllers.Base.prototype._attackCompatible = function (attack, opponentStand) {
    var m = mk.moves.types;
    if (opponentStand === m.SQUAT) {
      if (attack !== m.LOW_PUNCH && attack !== m.LOW_KICK) {
        return false;
      }
    }
    return true;
  };

  /**
   * Checks wheter the attacker is in the required distance to his opponent
   *
   * @private
   * @param {Fighter} attacker The fighter who attacks
   * @param {Fighter} opponent The fighter who will endure the attack
   * @return {boolean} true/false depending on the distance between the fighters
   */
  mk.controllers.Base.prototype._requiredDistance = function (attacker, opponent) {
    var fMiddle = attacker.getX() + attacker.getWidth() / 2,
      oMiddle = opponent.getX() + opponent.getWidth() / 2,
      distance = Math.abs(fMiddle - oMiddle),
      m = mk.moves.types,
      type = attacker.getMove().type,
      width = opponent.getWidth();
    if (distance <= width) {
      return true;
    }
    if (type === m.UPPERCUT &&
      distance <= width * 1.2) {
      return true;
    }
    if ((type === m.BACKWARD_JUMP_KICK ||
      type === m.FORWARD_JUMP_KICK ||
      type === m.FORWARD_JUMP_PUNCH ||
      type === m.BACKWARD_JUMP_PUNCH) &&
      distance <= width * 1.5) {
      return true;
    }
    return false;
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
    LEFT : 37,
    UP   : 38,
    DOWN : 40,
    BLOCK: 16,
    HP   : 65,
    LP   : 83,
    LK   : 68,
    HK   : 70
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
      var move = self._getMove(pressed, mk.controllers.keys, self._player);
      self._moveFighter(f, move);
    }, false);
    document.addEventListener('keyup', function (e) {
      delete pressed[e.keyCode];
      var move = self._getMove(pressed, mk.controllers.keys, self._player);
      self._moveFighter(f, move);
    }, false);
  };

  mk.controllers.Basic.prototype._moveFighter = function (f, m) {
    if (m) {
      f.setMove(m);
    }
  };

  mk.controllers.Basic.prototype._getMove = function (pressed, k, p) {
    var m = mk.moves.types,
      f = this.fighters[p],
      leftOrient = mk.fighters.orientations.LEFT,
      rightOrient = mk.fighters.orientations.RIGHT,
      orient = f.getOrientation(),
      self = this;

    if (f.getMove().type === m.SQUAT && !pressed[k.DOWN]) {
      return m.STAND_UP;
    }
    if (f.getMove().type === m.BLOCK && !pressed[k.BLOCK]) {
      return m.STAND;
    }
    if (Object.keys(pressed).length === 0) {
      return m.STAND;
    }
    if (pressed[k.BLOCK]) {
      return m.BLOCK;
    } else if (pressed[k.LEFT]) {
      if (pressed[k.UP]) {
        return m.BACKWARD_JUMP;
      } else if (pressed[k.HK] && orient === leftOrient) {
        return m.SPIN_KICK;
      }
      return m.WALK_BACKWARD;
    } else if (pressed[k.RIGHT]) {
      if (pressed[k.UP]) {
        return m.FORWARD_JUMP;
      } else if (pressed[k.HK] && orient === rightOrient) {
        return m.SPIN_KICK;
      }
      return m.WALK;
    } else if (pressed[k.DOWN]) {
      if (pressed[k.HP]) {
        return m.UPPERCUT;
      } else if (pressed[k.LK]) {
        return m.SQUAT_LOW_KICK;
      } else if (pressed[k.HK]) {
        return m.SQUAT_HIGH_KICK;
      } else if (pressed[k.LP]) {
        return m.SQUAT_LOW_PUNCH;
      }
      return m.SQUAT;
    } else if (pressed[k.HK]) {
      if (f.getMove().type === m.FORWARD_JUMP) {
        return m.FORWARD_JUMP_KICK;
      } else if (f.getMove().type === m.BACKWARD_JUMP) {
        return m.BACKWARD_JUMP_KICK;
      }
      return m.HIGH_KICK;
    } else if (pressed[k.UP]) {
      return m.JUMP;
    } else if (pressed[k.LK]) {
      if (f.getMove().type === m.FORWARD_JUMP) {
        return m.FORWARD_JUMP_KICK;
      } else if (f.getMove().type === m.BACKWARD_JUMP) {
        return m.BACKWARD_JUMP_KICK;
      }
      return m.LOW_KICK;
    } else if (pressed[k.LP]) {
      if (f.getMove().type === m.FORWARD_JUMP) {
        return m.FORWARD_JUMP_PUNCH;
      } else if (f.getMove().type === m.BACKWARD_JUMP) {
        return m.BACKWARD_JUMP_PUNCH;
      }
      return m.LOW_PUNCH;
    } else if (pressed[k.HP]) {
      if (f.getMove().type === m.FORWARD_JUMP) {
        return m.FORWARD_JUMP_PUNCH;
      } else if (f.getMove().type === m.BACKWARD_JUMP) {
        return m.BACKWARD_JUMP_PUNCH;
      }
      return m.HIGH_PUNCH;
    }
  };

  mk.controllers.WebcamInput = function (options) {
    mk.controllers.Basic.call(this, options);
  };

  mk.controllers.WebcamInput.prototype = new mk.controllers.Basic();

  mk.controllers.WebcamInput.prototype._initialize = function () {
    this._player = 1;
    this._addHandlers();
    this._addMovementHandlers();
  };

  mk.controllers.WebcamInput.prototype._addMovementHandlers = function () {
    if (Movement === undefined) {
      throw 'The WebcamInput requires movement.js';
    }
    var self = this,
      f = this.fighters[0];
    Movement.init({
      movementChanged: function (m) {
        var move = self._getMoveByMovement(m);
        self._moveFighter(f, move);
      },
      positionChanged: function (p) {
        var move = self._getMoveByMovement(p);
        self._moveFighter(f, move);
      }
    });
  };

  mk.controllers.WebcamInput.prototype._moveFighter = function (f, m) {
    if (m) {
      if (f.getMove().type === mk.moves.types.SQUAT &&
        m === mk.moves.types.STAND) {
        f.setMove(mk.moves.types.STAND_UP);
      } else {
        f.setMove(m);
      }
    }
  };

  mk.controllers.WebcamInput.prototype._getMoveByMovement = function (move) {
    var mkMoves = mk.moves.types,
      pos = Movement.positions,
      m = Movement.movements,
      current = this.fighters[this._player].getMove().type;
    if (move === pos.LEFT) {
      return mkMoves.WALK_BACKWARD;
    } else if (move === pos.RIGHT) {
      return mkMoves.WALK;
    } else if (move === pos.MIDDLE) {
      return mkMoves.STAND;
    } else if (move === m.STAND) {
      return mkMoves.STAND;
    } else if (move === m.SQUAT) {
      return mkMoves.SQUAT;
    } else if (move === m.LEFT_ARM_UP ||
           move === m.RIGHT_ARM_UP) {
      return mkMoves.HIGH_PUNCH;
    } else if (move === m.LEFT_LEG_UP ||
           move === m.RIGHT_LEG_UP) {
      return mkMoves.LOW_KICK;
    } else if (move === m.SQUAT_LEFT_ARM_UP ||
           move === m.SQUAT_RIGHT_ARM_UP) {
      return mkMoves.SQUAT_LOW_PUNCH;
    }
    return mkMoves.STAND;
  };

  mk.controllers.keys.p1 = {
    RIGHT: 74,
    LEFT : 71,
    UP   : 89,
    DOWN : 72,
    BLOCK: 16,
    HP   : 65,
    LP   : 83,
    LK   : 68,
    HK   : 70
  };

  mk.controllers.keys.p2 = {
    RIGHT: 39,
    LEFT : 37,
    UP   : 38,
    DOWN : 40,
    BLOCK: 17,
    HP   : 80,
    LP   : 219,
    LK   : 221,
    HK   : 220
  };

  mk.controllers.Multiplayer = function (options) {
    mk.controllers.Basic.call(this, options);
  };

  mk.controllers.Multiplayer.prototype = new mk.controllers.Basic();

  mk.controllers.Multiplayer.prototype._initialize = function () {
    this._addHandlers();
  };

  mk.controllers.Multiplayer.prototype._addHandlers = function () {
    var pressed = {},
      self = this,
      f1 = this.fighters[0],
      f2 = this.fighters[1];

    document.addEventListener('keydown', function (e) {
      pressed[e.keyCode] = true;
      var move = self._getMove(pressed, mk.controllers.keys.p1, 0);
      self._moveFighter(f1, move);
      move = self._getMove(pressed, mk.controllers.keys.p2, 1);
      self._moveFighter(f2, move);
    }, false);

    document.addEventListener('keyup', function (e) {
      delete pressed[e.keyCode];
      var move = self._getMove(pressed, mk.controllers.keys.p1, 0);
      self._moveFighter(f1, move);
      move = self._getMove(pressed, mk.controllers.keys.p2, 1);
      self._moveFighter(f2, move);
    }, false);
  };

  mk.controllers.Multiplayer.prototype._moveFighter = function (fighter, move) {
    if (move) {
      fighter.setMove(move);
    }
  };

  mk.controllers.Network = function (options) {
    mk.controllers.Basic.call(this, options);
    this._isHost = options.isHost;
    this._gameName = options.gameName;
    this._transport = options.transport || this.Transports.socketio;
  };

  mk.callbacks.PLAYER_CONNECTED = 'player-connected';

  mk.controllers.Network.prototype = new mk.controllers.Basic();

  mk.controllers.Network.prototype.Requests = {
    CREATE_GAME: 'create-game',
    JOIN_GAME  : 'join-game'
  };

  mk.controllers.Network.prototype.Responses = {
    SUCCESS        : 0,
    GAME_EXISTS    : 1,
    GAME_NOT_EXISTS: 2,
    GAME_FULL      : 3
  };

  mk.controllers.Network.prototype.Messages = {
    EVENT           : 'event',
    LIFE_UPDATE     : 'life-update',
    POSITION_UPDATE : 'position-update',
    PLAYER_CONNECTED: 'player-connected'
  };

  mk.controllers.Network.prototype.Transports = {
    socketio: {}
  };

  mk.controllers.Network.prototype.Transports.socketio.init = function() {
    this._socket = io.connect();
  };

  mk.controllers.Network.prototype.Transports.socketio.emit = function() {
    this._socket.emit.apply(this._socket, arguments);
  };

  mk.controllers.Network.prototype.Transports.socketio.on = function() {
    this._socket.on.apply(this._socket, arguments);
  };

  mk.controllers.Network.prototype._createGame = function (game) {
    this._transport.emit(this.Requests.CREATE_GAME, this._gameName);
    this._addSocketHandlers();
  };

  mk.controllers.Network.prototype._addSocketHandlers = function () {
    var opponent = this.fighters[+!this._player],
      f = this.fighters[this._player],
      m = this.Messages,
      self = this;
    this._transport.on(m.EVENT, function (move) {
      opponent.setMove(move);
    });
    this._transport.on(m.LIFE_UPDATE, function (data) {
      opponent.setLife(data);
    });
    this._transport.on(m.POSITION_UPDATE, function (data) {
      opponent.setX(data.x);
      opponent.setY(data.y);
    });
    setInterval(function () {
      self._transport.emit(m.LIFE_UPDATE, f.getLife());
    }, 2000);
    setInterval(function () {
      if (!f.isJumping()) {
        self._transport.emit(m.POSITION_UPDATE, {
          x: f.getX(),
          y: f.getY()
        });
      }
    }, 500);
    if (this._isHost) {
      this._transport.on(this.Messages.PLAYER_CONNECTED, function (data) {
        var c = self._callbacks[mk.callbacks.PLAYER_CONNECTED];
        if (typeof c  === 'function') {
          c();
        }
      });
    }
  };

  mk.controllers.Network.prototype._moveFighter = function (f, m) {
    if (m) {
      this._transport.emit('event', m);
      f.setMove(m);
    }
  };

  mk.controllers.Network.prototype._joinGame = function (game) {
    this._transport.emit(this.Requests.JOIN_GAME, this._gameName);
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
    this._transport.init();
    this._transport.on('connect', function () {
      if (self._isHost) {
        self._createGame(self._gameName);
      } else {
        self._joinGame(self._gameName);
      }
    });
    this._transport.on('response', function (response) {
      if (response !== self.Responses.SUCCESS) {
        alert('Error while connecting to the server.');
      }
    });
    this._transport.on('disconnect', function () {
      alert('Disconnected from the server.');
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
      case 'multiplayer':
        mk.game = new mk.controllers.Multiplayer(options);
        break;
      case 'webcaminput':
        mk.game = new mk.controllers.WebcamInput(options);
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
      TOWER      : 0,
      THRONE_ROOM: 1
    }
  };

  mk.arenas.Arena = function (options) {
    this.width = options.width || 600;
    this.height = options.height || 400;
    this.arena = options.arena || mk.arenas.types.TOWER;
    this.fighters = options.fighters;
    this._container = options.container;
    this._game = options.game;
  };

  mk.arenas.Arena.prototype.init = function () {
    var canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    this._container.appendChild(canvas);
    this._context = canvas.getContext('2d');
    this._canvas = canvas;
    this.refresh();
  };

  mk.arenas.Arena.prototype.destroy = function () {
    this._container.removeChild(this._canvas);
    this._canvas = undefined;
    this._context = undefined;
    this._container = undefined;
    this._game = undefined;
    this.fighters = undefined;
    this.arena = undefined;
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
      op = { x: opponent.getX(), y: opponent.getY() },
      isOver = pos.y + fighter.getVisibleHeight() <= op.y;

    if (pos.x <= 0) {
      pos.x = 0;
    }
    if (pos.x >= this.width - fighter.getVisibleWidth()) {
      pos.x = this.width - fighter.getVisibleWidth();
    }

    if (!isOver) {
      if (fighter.getOrientation() === mk.fighters.orientations.LEFT) {
        if (pos.x + fighter.getVisibleWidth() > op.x) {
          pos = this._synchronizeFighters(pos, fighter, opponent);
        }
      } else {
        if (pos.x < op.x + opponent.getVisibleWidth()) {
          pos = this._synchronizeFighters(pos, fighter, opponent);
        }
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
    var diff;
    if (fighter.getOrientation() === mk.fighters.orientations.LEFT) {
      diff = Math.min(this.width -
              (opponent.getX() + opponent.getVisibleWidth() +
              fighter.getVisibleWidth()),
              pos.x - fighter.getX());

      pos.x = fighter.getX() + diff;
      if (diff > 0) {
        opponent.setX(opponent.getX() + diff);
      }
    } else {
      diff = Math.min(opponent.getX(), fighter.getX() - pos.x);
      if (diff > 0) {
        pos.x = fighter.getX() - diff;
        opponent.setX(opponent.getX() - diff);
        if (opponent.getX() + opponent.getWidth() > pos.x) {
          pos.x = opponent.getX() + opponent.getVisibleWidth();
        }
      } else {
        pos.x = fighter.getX();
        if (opponent.getX() + opponent.getWidth() > pos.x) {
          pos.x = opponent.getX() + opponent.getVisibleWidth();
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
    STAND              : 'stand',
    WALK               : 'walking',
    WALK_BACKWARD      : 'walking-backward',
    SQUAT              : 'squating',
    STAND_UP           : 'stand-up',
    HIGH_KICK          : 'high-kick',
    JUMP               : 'jumping',
    FORWARD_JUMP       : 'forward-jump',
    BACKWARD_JUMP      : 'backward-jump',
    LOW_KICK           : 'low-kick',
    LOW_PUNCH          : 'low-punch',
    HIGH_PUNCH         : 'high-punch',
    FALL               : 'fall',
    WIN                : 'win',
    ENDURE             : 'endure',
    SQUAT_ENDURE       : 'squat-endure',
    UPPERCUT           : 'uppercut',
    SQUAT_LOW_KICK     : 'squat-low-kick',
    SQUAT_HIGH_KICK    : 'squat-high-kick',
    SQUAT_LOW_PUNCH    : 'squat-low-punch',
    KNOCK_DOWN         : 'knock-down',
    ATTRACTIVE_STAND_UP: 'attractive-stand-up',
    SPIN_KICK          : 'spin-kick',
    BLOCK              : 'blocking',
    FORWARD_JUMP_KICK  : 'forward-jump-kick',
    BACKWARD_JUMP_KICK : 'backward-jump-kick',
    BACKWARD_JUMP_PUNCH: 'backward-jump-punch',
    FORWARD_JUMP_PUNCH : 'forward-jump-punch'
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
    this._actionPending = [];
  };

  mk.moves.Move.prototype.go = function (step) {
    var self = this;
    if (typeof this._beforeGo === 'function')
      this._beforeGo();
    this._currentStep = step || 0;
    this._nextStep(this._action);
    this._interval = setInterval(function () {
      self._nextStep(self._action);
    }, this._stepDuration);
  };

  mk.moves.Move.prototype._action = function () {};

  mk.moves.Move.prototype._nextStep = function (callback) {
    var img = document.createElement('img'),
      conf = mk.config;

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

  mk.moves.Stand.prototype._beforeGo = function () {
    this.owner.setY(mk.config.PLAYER_TOP);
  };

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
    this.owner.setY(mk.config.PLAYER_TOP);
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
    this.owner.setY(mk.config.PLAYER_TOP);
  };

  mk.moves.FiniteMove = function (owner, type, duration) {
    mk.moves.Move.call(this, owner, type, duration);
    this._bottom = undefined;
  };

  mk.moves.FiniteMove.prototype = new mk.moves.Move();

  mk.moves.FiniteMove.prototype._moveNextStep = function () {
    if (this._currentStep >= this._totalSteps - 1) {
      this._currentStep = this._totalSteps - 1;
    } else {
      this._currentStep = this._currentStep + 1;
    }
  };

  mk.moves.FiniteMove.prototype._beforeGo = function () {
    this._bottom = this.owner.getBottom();
    this.owner.lock();
  };

  mk.moves.FiniteMove.prototype._beforeStop = function () {
    this.owner.unlock();
  };

  mk.moves.FiniteMove.prototype.keepDistance = function () {
    var currentBottom = this.owner.getBottom();
    if (currentBottom > this._bottom) {
      this.owner.setY(this.owner.getY() + currentBottom - this._bottom);
    }
    if (currentBottom < this._bottom) {
      this.owner.setY(this.owner.getY() - (this._bottom - currentBottom));
    }
  };

  mk.moves.Fall = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.FALL, 100);
    this._totalSteps = 7;
  };

  mk.moves.Fall.prototype = new mk.moves.FiniteMove();

  mk.moves.Fall.prototype._action = function () {
    this.keepDistance();
  };

  mk.moves.Win = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.WIN, 100);
    this._totalSteps = 10;
  };

  mk.moves.Win.prototype = new mk.moves.FiniteMove();

  mk.moves.Win.prototype._action = function () {
    this.keepDistance();
  };

  mk.moves.Win.prototype._beforeGo = function () {
    this.owner.lock();
    this.owner.setY(mk.config.PLAYER_TOP);
    this._bottom = this.owner.getBottom();
  };

  mk.moves.Squat = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.SQUAT, 40);
    this._totalSteps = 3;
  };

  mk.moves.Squat.prototype = new mk.moves.FiniteMove();

  mk.moves.Squat.prototype._action = function () {
    this.keepDistance();
    if (this._currentStep === 2) {
      this.stop();
    }
  };

  mk.moves.Block = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.BLOCK, 40);
    this._totalSteps = 3;
  };

  mk.moves.Block.prototype = new mk.moves.FiniteMove();

  mk.moves.Block.prototype._action = function () {
    this.keepDistance();
    if (this._currentStep === 2) {
      this.stop();
    }
  };

  mk.moves.StandUp = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.STAND_UP, 100);
    this._totalSteps = 3;
  };

  mk.moves.StandUp.prototype = new mk.moves.FiniteMove();

  mk.moves.StandUp.prototype._action = function () {
    if (this._currentStep === 2) {
      this.stop();
      this.owner.setMove(mk.moves.types.STAND);
      this.owner.setY(mk.config.PLAYER_TOP);
    }
    this.keepDistance();
  };

  mk.moves.AttractiveStandUp = function (owner) {
    mk.moves.FiniteMove.call(this, owner, mk.moves.types.ATTRACTIVE_STAND_UP, 100);
    this._totalSteps = 4;
  };

  mk.moves.AttractiveStandUp.prototype = new mk.moves.FiniteMove();

  mk.moves.AttractiveStandUp.prototype._action = function () {
    if (this._currentStep === this._totalSteps - 1) {
      this.stop();
      this.owner.setMove(mk.moves.types.STAND);
    } else {
      this.keepDistance();
    }
  };

  mk.moves.AttractiveStandUp.prototype._beforeStop = function () {
    this.owner.unlock();
    this.owner.setY(mk.config.PLAYER_TOP);
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

  mk.moves.KnockDown = function (owner) {
    mk.moves.Move.call(this, owner, mk.moves.types.KNOCK_DOWN, 80);
    this._totalSteps = 10;
  };

  mk.moves.KnockDown.prototype = new mk.moves.Move();

  mk.moves.KnockDown.prototype._action = function () {
    if (this._currentStep === this._totalSteps - 1) {
      this.stop();
      this.owner.setMove(mk.moves.types.ATTRACTIVE_STAND_UP);
    } else {
      var xDisplacement = 25;
      if (this.owner.getOrientation() === mk.fighters.orientations.LEFT) {
        xDisplacement = -xDisplacement;
      }
      if (this._currentStep + 1 > (this._totalSteps - 1) / 2) {
        this.owner.setY(this.owner.getY() + 10);
        this.owner.setX(this.owner.getX() + xDisplacement);
      } else {
        this.owner.setY(this.owner.getY() + 10);
        this.owner.setX(this.owner.getX() + xDisplacement);
      }
    }
  };

  mk.moves.KnockDown.prototype._beforeGo = function () {
    this.owner.lock();
  };

  mk.moves.KnockDown.prototype._beforeStop = function () {
    this.owner.unlock();
  };

  mk.moves.KnockDown.prototype._moveNextStep = function () {
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
    this._ownerHeight = owner.getVisibleHeight();
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
    this._ownerHeight = owner.getVisibleHeight();
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
    mk.moves.Move.call(this,
      options.owner,
      options.type,
      options.duration || 40);
    this._damage = options.damage;
    this._totalSteps = options.steps;
    this._moveBack = false;
    this._hitPassed = false;
    this._returnStand = options.returnStand || mk.moves.types.STAND;
    this._returnStandStep = options.returnStandStep || 0;
  };

  mk.moves.Attack.prototype = new mk.moves.Move();

  mk.moves.Attack.prototype._moveNextStep = function () {
    if (!this._moveBack) {
      this._currentStep += 1;
    }
    if (this._moveBack) {
      this._currentStep -= 1;
      if (this._currentStep <= 0) {
        this.stop();
        this.owner.setMove(this._returnStand, this._returnStandStep);
      }
    }
    if (this._currentStep >= this._totalSteps) {
      if (this._dontReturn) {
        this.stop();
        this.owner.setMove(this._returnStand);
      } else {
        this._moveBack = true;
        this._currentStep -= 1;
      }
    }
  };

  mk.moves.Attack.prototype._action = function () {
    this.keepDistance();
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
    this._bottom = this.owner.getBottom();
  };

  mk.moves.Attack.prototype.keepDistance = function () {
    var currentBottom = this.owner.getBottom();
    if (currentBottom > this._bottom) {
      this.owner.setY(this.owner.getY() + currentBottom - this._bottom);
    }
    if (currentBottom < this._bottom) {
      this.owner.setY(this.owner.getY() - (this._bottom - currentBottom));
    }
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


  mk.moves.Uppercut = function (owner) {
    mk.moves.Attack.call(this, {
      owner: owner,
      type: mk.moves.types.UPPERCUT,
      steps: 5,
      damage: 13,
      duration: 60
    });
  };

  mk.moves.Uppercut.prototype = new mk.moves.Attack();

  mk.moves.Uppercut.prototype._beforeStop = function () {
    this.owner.unlock();
    this.keepDistance();
  };

  mk.moves.Uppercut.prototype._action = function () {
    this.keepDistance();
    if (!this._hitPassed &&
      this._currentStep === Math.round(this._totalSteps / 2)) {
      this.owner.attack(this.getDamage());
      this._hitPassed = true;
    }
  };

  mk.moves.SquatLowKick = function (owner) {
    mk.moves.Attack.call(this, {
      type: mk.moves.types.SQUAT_LOW_KICK,
      owner: owner,
      steps: 3,
      damage: 4,
      duration: 70,
      returnStand: mk.moves.types.SQUAT,
      returnStandStep: 2
    });
  };

  mk.moves.SquatLowKick.prototype = new mk.moves.Attack();

  mk.moves.SquatHighKick = function (owner) {
    mk.moves.Attack.call(this, {
      type: mk.moves.types.SQUAT_HIGH_KICK,
      owner: owner,
      steps: 4,
      damage: 6,
      duration: 70,
      returnStand: mk.moves.types.SQUAT,
      returnStandStep: 2
    });
  };

  mk.moves.SquatHighKick.prototype = new mk.moves.Attack();

  mk.moves.SquatLowPunch = function (owner) {
    mk.moves.Attack.call(this, {
      type: mk.moves.types.SQUAT_LOW_PUNCH,
      owner: owner,
      steps: 3,
      damage: 4,
      duration: 70,
      returnStand: mk.moves.types.SQUAT,
      returnStandStep: 2
    });
  };

  mk.moves.SquatLowPunch.prototype = new mk.moves.Attack();

  mk.moves.SpinKick = function (owner) {
    mk.moves.Attack.call(this, {
      owner: owner,
      type: mk.moves.types.SPIN_KICK,
      steps: 8,
      damage: 13,
      duration: 60,
      returnStand: mk.moves.types.STAND
    });
    this._dontReturn = true;
  };

  mk.moves.SpinKick.prototype = new mk.moves.Attack();

  mk.moves.JumpAttack = function (owner, type, damage, isForward) {
    mk.moves.Attack.call(this, {
      owner: owner,
      type: type,
      steps: 3,   //to be overriden by the fighter
      damage: damage,
      duration: 80
    });
    this._offset = {
      x: -23,
      y: 26
    };
    if (isForward) {
      this._offset = {
        x: 23,
        y: 26
      };
    }
    this._totalPics = 2;
    this._counter = 0;
  };

  mk.moves.JumpAttack.prototype = new mk.moves.Attack();

  mk.moves.JumpAttack.prototype._moveNextStep = function () {
    this._currentStep += 1;
    this._counter += 1;
    if (this._totalPics <= this._currentStep) {
      this._currentStep = this._totalPics;
    }
    if (this._counter >= this._totalSteps) {
      if (this.owner.getMove().type !== mk.moves.types.WIN) {
        this.stop();
        this.owner.setMove(mk.moves.types.STAND);
        this.owner.setY(mk.config.PLAYER_TOP);
      }
    }
  };

  mk.moves.JumpAttack.prototype._action = function () {
    if (!this._hitPassed &&
      this._currentStep === this._totalPics) {
      this.owner.attack(this.getDamage());
      this._hitPassed = true;
    }
    this.owner.setY(this.owner.getY() + this._offset.y);
    this.owner.setX(this.owner.getX() + this._offset.x);
  };

  mk.moves.JumpAttack.prototype._beforeGo = function () {
    this._hitPassed = false;
    this._counter = 0;
    this.owner.lock();
  };

  mk.moves.JumpKick = function (owner, isForward) {
    var type = mk.moves.types.BACKWARD_JUMP_KICK;
    if (isForward) {
      type = mk.moves.types.FORWARD_JUMP_KICK;
    }
    mk.moves.JumpAttack.call(this, owner, type, 10, isForward);
  };

  mk.moves.JumpKick.prototype = new mk.moves.JumpAttack();

  mk.moves.JumpPunch = function (owner, isForward) {
    var type = mk.moves.types.BACKWARD_JUMP_PUNCH;
    if (isForward) {
      type = mk.moves.types.FORWARD_JUMP_PUNCH;
    }
    mk.moves.JumpAttack.call(this, owner, type, 9, isForward);
  };

  mk.moves.JumpPunch.prototype = new mk.moves.JumpAttack();




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
    this._width = 30;
    this._height = 60;
    this._locked = false;
    this._position = {
      x: 50,
      y: mk.config.PLAYER_TOP
    };
    this.init();
  };

  mk.fighters.Fighter.prototype.init = function (callback) {
    this.moves = {};
    this.moves[mk.moves.types.STAND] = new mk.moves.Stand(this);
    this.moves[mk.moves.types.WALK] = new mk.moves.Walk(this);
    this.moves[mk.moves.types.WALK_BACKWARD] = new mk.moves.WalkBack(this);
    this.moves[mk.moves.types.SQUAT] = new mk.moves.Squat(this);
    this.moves[mk.moves.types.BLOCK] = new mk.moves.Block(this);
    this.moves[mk.moves.types.STAND_UP] = new mk.moves.StandUp(this);
    this.moves[mk.moves.types.ATTRACTIVE_STAND_UP] = new mk.moves.AttractiveStandUp(this);
    this.moves[mk.moves.types.HIGH_KICK] = new mk.moves.HighKick(this);
    this.moves[mk.moves.types.LOW_KICK] = new mk.moves.LowKick(this);
    this.moves[mk.moves.types.SPIN_KICK] = new mk.moves.SpinKick(this);
    this.moves[mk.moves.types.LOW_PUNCH] = new mk.moves.LowPunch(this);
    this.moves[mk.moves.types.HIGH_PUNCH] = new mk.moves.HighPunch(this);
    this.moves[mk.moves.types.UPPERCUT] = new mk.moves.Uppercut(this);
    this.moves[mk.moves.types.SQUAT_LOW_KICK] = new mk.moves.SquatLowKick(this);
    this.moves[mk.moves.types.SQUAT_HIGH_KICK] = new mk.moves.SquatHighKick(this);
    this.moves[mk.moves.types.SQUAT_LOW_PUNCH] = new mk.moves.SquatLowPunch(this);
    this.moves[mk.moves.types.FALL] = new mk.moves.Fall(this);
    this.moves[mk.moves.types.KNOCK_DOWN] = new mk.moves.KnockDown(this);
    this.moves[mk.moves.types.WIN] = new mk.moves.Win(this);
    this.moves[mk.moves.types.JUMP] = new mk.moves.Jump(this);
    this.moves[mk.moves.types.FORWARD_JUMP_KICK] = new mk.moves.JumpKick(this, true);
    this.moves[mk.moves.types.BACKWARD_JUMP_KICK] = new mk.moves.JumpKick(this, false);
    this.moves[mk.moves.types.FORWARD_JUMP_PUNCH] = new mk.moves.JumpPunch(this, true);
    this.moves[mk.moves.types.BACKWARD_JUMP_PUNCH] = new mk.moves.JumpPunch(this, false);
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

  mk.fighters.Fighter.prototype.isJumping = function () {
    if (!this._currentMove) return false;
    var move = this._currentMove.type,
      m = mk.moves.types;
    if (move === m.JUMP || move === m.BACKWARD_JUMP ||
      move === m.FORWARD_JUMP || move === m.FORWARD_JUMP_KICK ||
      move === m.BACKWARD_JUMP_KICK || move === m.FORWARD_JUMP_PUNCH ||
      move === m.BACKWARD_JUMP_PUNCH) {
      return true;
    }
    return false;
  };

  mk.fighters.Fighter.prototype.getName = function () {
    return this._name;
  };

  mk.fighters.Fighter.prototype.setArena = function (arena) {
    this._arena = arena;
  };

  mk.fighters.Fighter.prototype.getWidth = function () {
    if (this._currentState && this._currentState.width) {
      return this._currentState.width;
    }
    return this._width;
  };

  mk.fighters.Fighter.prototype.getVisibleWidth = function () {
    return this._width;
  };

  mk.fighters.Fighter.prototype.getVisibleHeight = function () {
    if (this._currentState && this._currentState.height) {
      return this._currentState.height;
    }
    return this._height;
  };

  mk.fighters.Fighter.prototype.getVisibleHeight = function () {
    return this._height;
  };

  mk.fighters.Fighter.prototype.setHeight = function (height) {
    this._height = height;
  };

  mk.fighters.Fighter.prototype.setWidth = function (width) {
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

  mk.fighters.Fighter.prototype.endureAttack = function (damage, attackType) {
    var m = mk.moves.types;

    if (this.getMove().type === m.BLOCK) {
      damage *= mk.config.BLOCK_DAMAGE;
    } else {
      this.unlock();
      if (this.getMove().type === m.SQUAT) {
        this.setMove(m.SQUAT_ENDURE);
      } else {
        if (attackType === m.UPPERCUT ||
          attackType === m.SPIN_KICK) {
          this.setMove(m.KNOCK_DOWN);
        } else {
          this.setMove(m.ENDURE);
        }
      }
    }
    this.setLife(this.getLife() - damage);
    if (this.getLife() === 0) {
      this._game.fighterDead(this);
      this.unlock();
      this.setMove(mk.moves.types.FALL);
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

  mk.fighters.Fighter.prototype.setMove = function (move, step) {
    step = step || 0;
    var m = mk.moves.types,
      currentMove = this._currentMove;

    if (!(move in this.moves))
      throw 'This player does not has the move - ' + move;

    if (this._currentMove && this._currentMove.type === move)
      return;

    if (move === m.FORWARD_JUMP_KICK || move === m.BACKWARD_JUMP_KICK ||
      move === m.FORWARD_JUMP_PUNCH || move === m.BACKWARD_JUMP_PUNCH) {
      if (currentMove._currentStep >= currentMove._totalSteps / 2) {
        this._currentMove.stop();
        this.unlock();
        this._currentMove = this.moves[move];
        this._currentMove._totalSteps = currentMove._totalSteps - currentMove._currentStep;
      }
    }

    if (this._locked && move !== m.WIN)
      return;

    if (this._currentMove && typeof this._currentMove.stop === 'function')
      this._currentMove.stop();

    this._currentMove = this.moves[move];
    this._currentMove.go(step);
  };

  mk.fighters.Fighter.prototype.getMove = function () {
    return this._currentMove;
  };

  window.mk = mk;

}());
