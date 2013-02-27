#mk.js

This is simple fighting game created with HTML5 canvas and JavaScript. It has three game modes:
* `Basic` - with one active and on inactive player.
* `Multiplayer` - with two active players on one computer.
* `Network` - with two active players, playing over the network.

Each mode can be easily chosen by picking a `gameType` when specifying the game options.
The `multiplayer` mode can be tested [here](http://mk.mgechev.com/).
For the network game you need to install the server:

    git clone git@github.com:mgechev/mk.js
    cd mk.js/server
    npm install
    node server.js

The server will be started on port `55555`. Open your browser and go to `http://localhost:55555`. Both players must enter the same game name to play together.

#License

This software is distributed under the terms of the MIT license.
