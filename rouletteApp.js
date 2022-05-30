const express = require('express');
const path = require('path');
const SocketIO = require('socket.io');
const colors = require('colors/safe');
const uuidv4 = require('uuid/v4');
const cors = require('cors');
// const path = require('path')

const Game = require('./classes/game');
const app = express();

// Settings
app.set('port', process.env.PORT || 3030);
//app.set('views', path.join(__dirname, '/views'));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ useNewUrlParser: true }));

// Enable Cors
app.use(cors());

// Public Path
const publicPath = path.resolve(__dirname, 'public');
app.use(express.static(publicPath));

// Routes
app.get('/mobile', (req, res) => {
    res.sendFile(publicPath + '/mobile/index.html');
});

app.get('/desktop', (req, res) => {
    res.sendFile(publicPath + '/desktop/index.html');
});

// Start server
const server = app.listen(app.get('port'), () => {
    console.log('[Playmex] ' + colors.blue('♠ ') + colors.red('♥') + ' Roulette server ' + colors.green('♣') +
        colors.yellow(' ♦') + ' on port', app.get('port'));

    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
});

// Web Sockets
const io = SocketIO(server);
var games = [];
Game.io = io;

io.on('connection', (socket) => {
    console.log('Player connected', socket.id);
    socket.isReady = false;
    socket.emit('player:connected', { 'message': 'Welcome to Roulette' });

    EraseEmptyRooms();
    io.emit('room:list', { "rooms": GetPublicRooms() });

    socket.on('disconnect', () => {
        console.log(socket.username ? socket.username : socket.id, 'is disconnected');
        let room = socket.myRoom;
        let i = socket.gameIndex;
        if (i < 0 || typeof i === 'undefined') {
            console.log(socket.username ? socket.username : socket.id, 'Was not part of a room');
            return;
        }

        try {
            var index = games[i].players.indexOf(socket);

            if (index > -1) {
                games[i].players.splice(index, 1);
            }
        } catch (err) {
            console.log('Does not belong to any room');
        }
        EraseEmptyRooms();
        console.log(socket.username ? socket.username : socket.id, 'left the room:', room);
        let nickname = socket.username;
        let playerID = socket.id;
        socket.to(room).emit('player:leave', { nickname, playerID });
        io.emit('room:list', { "rooms": GetPublicRooms() });
    });

    socket.on('player:leave', () => {
        console.log(socket.username ? socket.username : socket.id, 'left the room');
        let room = socket.myRoom;
        let i = socket.gameIndex;
        console.log('leaved the room', room);

        try {
            let index = games[i].players.indexOf(socket);
            console.log('leaved the room', room);
            if (index > -1) {
                games[i].players.splice(index, 1);
            }
        } catch (err) {
            console.log('Does not belong to any room');
        }
        EraseEmptyRooms();
        let nickname = socket.username;
        let playerID = socket.id;

        io.in(socket.myRoom).emit('player:leave', { nickname, playerID });
        io.emit('room:list', { "rooms": GetPublicRooms() });
    });

    socket.on('player:arrived', () => {
        let nickname = socket.username;
        let balance = socket.balance;
        let medalCount = socket.medalCount;
        let avatarID = socket.avatar;
        let playerID = socket.id;
        socket.to(socket.myRoom).emit('player:arrived', { nickname, balance, medalCount, avatarID, playerID });
        var round = games[socket.gameIndex];
        socket.emit('room:sync', { 'players': GetPlayersInfoFromRoom(round, socket.id) });
    });

    socket.on('room:join', (data) => {
        const room = io.nsps['/'].adapter.rooms[data.room];
        if (room) { //If room exist
            if (room.length < 6) { // Join room if is not full

                SetSocketPropierties(socket, data, data.room);
                socket.join(data.room);
                socket.gameIndex = GetGameIndex(data.room);
                const i = socket.gameIndex;

                if (games[i].players.indexOf(socket) >= 0)
                    return;

                games[i].players.push(socket);
                socket.emit('room:joined', {
                    'balance': data.balance,
                    'waitTime': games[i].waitTime,
                    'minBet': games[i].minBet,
                    'maxBet': games[i].maxBet,
                    'id': socket.id,
                    'isEuropean': games[i].isEuropean
                });
                console.log(data.username, 'Is joining the room...', data.room);
            } else {
                console.log(data.username, 'found room full...');
                socket.emit('err:room', { 'message': 'The room you try to access is full. Choose another.', 'flag': 2 });
                return;
            }
            socket.myRoom = data.room;
            io.emit('room:list', { 'rooms': GetPublicRooms() });
        } else {
            console.log("Room does not exist.");
            socket.emit('err:room', { 'message': 'The room you try to access does not exist. Choose another or create one.', 'flag': 1 });
        }
    });

    socket.on('room:create', (data) => {
        const exist = io.nsps['/'].adapter.rooms[data.room];
        if (exist) {
            socket.emit('err:room', { 'message': 'You are trying to create a room that already exist. Choose another name.', 'flag': 0 });
            return;
        }
        const room = (data.room) ? data.room : uuidv4();
        SetSocketPropierties(socket, data, room);

        console.log(data);

        console.log(data.username, 'Created a new', data.isPrivate ? 'Private' : 'Public', 'room:', data.isEuropean ? '[European]' : '[American]', room);
        socket.join(room);
        socket.emit('room:joined', { 'balance': data.balance, 'waitTime': data.waitTime, 'minBet': data.minBet, 'maxBet': data.maxBet, 'id': socket.id, 'isEuropean': data.isEuropean });

        games.push(new Game(room, data.isPrivate, data.waitTime, data.minBet, data.maxBet, data.isEuropean));

        socket.gameIndex = games.length - 1;
        games[socket.gameIndex].players.push(socket);

        io.emit('room:list', { 'rooms': GetPublicRooms() });
    });

    socket.on('chat_message', (data) => {
        io.in(socket.myRoom).emit("chat_message", data);
    });

    socket.on('bet:update', (data) => {
        socket.isReady = data.pool.length > 0;
        //console.log(data.pool.length, 'Bets:', data.pool);

        socket.to(socket.myRoom).emit('bet:ghost', { data, 'id': socket.id });

        var round = games[socket.gameIndex];

        if (round.isOnPlay || !socket.isReady) return;

        console.log('Starting in game:', socket.gameIndex);
        round.isOnPlay = true;

        //socket.emit('player:ready', { 'username': socket.username });
        StartRound(round);
    });

    socket.on('player:balance', (data) => {
        console.log('Status', data);
        io.in(socket.myRoom).emit('player:balance', { 'balance': data.balance, 'medalScore': data.medalScore, 'id': socket.id });
    });
});

/*
General functions
*/
function GetGameIndex(room) {
    for (let i = 0; i < games.length; i++)
        if (games[i].room == room)
            return i;
    return -1;
}

function StartRound(round) {
    console.log('On Main Timer', round.waitTime);

    io.in(round.room).emit('room:timer', { 'time': round.waitTime });

    let timeOut = setTimeout(() => {
        clearTimeout(timeOut);
        if (typeof round !== 'undefined' && round !== null) {
            LaunchBall(round);
        } else
            console.log('There is no round aviable');

    }, (round.waitTime * 1000) + 3000);
}

function LaunchBall(round) {
    io.in(round.room).emit('roulette:spin', { 'result': round.getResult(), 'isEuropean': round.isEuropean });
}

function GetPublicRooms() {
    var publicRooms = [];
    for (let i = 0; i < games.length; i++) {

        if (games[i].isPrivate) continue;

        let name = games[i].room;
        let poblation = games[i].players.length;
        let isEuropean = games[i].isEuropean;
        publicRooms.push({ name, poblation, isEuropean });
    }
    console.log(games.length, 'Public Rooms:', publicRooms.length, publicRooms);
    return publicRooms;
}

function EraseEmptyRooms() {
    for (let i = 0; i < games.length; i++) {
        if (games[i].players.length < 1) {
            games[i].resetTimeOut();
            games.splice(i, 1);
        }
    }
    console.log('Games left:', games.length);
}

function GetPlayersInfoFromRoom(round, id) {
    let players = [];
    for (let j = 0; j < round.players.length; j++) {
        if (round.players[j].id === id)
            continue;
        let nickname = round.players[j].username;
        let balance = round.players[j].balance;
        let medalCount = round.players[j].medalrsCount;
        let avatarID = round.players[j].avatar;
        let playerID = round.players[j].id;
        players.push({ nickname, balance, medalCount, avatarID, playerID });
    }
    console.log(players);
    return players;
}

function SetSocketPropierties(socket, data, room) {
    socket.username = data.username;
    socket.balance = data.balance;
    socket.avatar = data.avatar;
    socket.medalCount = 0;
    socket.myRoom = room;
    socket.currentBet = 0;
    socket.isReady = false;
}