function Game(id) {
    this._id = id;
    this._players = [];
}

Game.prototype.getId = function () {
    return this._id;
};

Game.prototype.addPlayer = function (p) {
    if (this._players.length > 1) {
        return false;
    }
    this._players.push(p);
    if (this._players.length > 1) {
        this._addHandlers();
    }
    return true;
};

Game.prototype._addHandlers = function () {
    var p1 = this._players[0],
        p2 = this._players[1];
    p1.on('event', function (data) {
        p2.emit('event', data);
    });
    p2.on('event', function (data) {
        p1.emit('event', data);
    });
};

function GameCollection() {
    this._games = {};
}

GameCollection.prototype.getGame = function (game) {
    return this._games[game];
};

GameCollection.prototype.createGame = function (id) {
    if (this._games[game]) {
        return false;
    }
    var game = new Game(id);
    this._games[id] = game;
    return true;
};

exports.GameCollection = GameCollection;
