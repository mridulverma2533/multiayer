const wheel = require('../controllers/wheel.controller');
class Game {
    constructor(roomName, isPrivate, waitTime, minBet, maxBet, isEuropean) {
        this.room = roomName;
        this.players = [];
        this.timeOut = null;
        this.waitTime = waitTime;
        this.minBet = minBet;
        this.maxBet = maxBet;
        this.isPrivate = isPrivate;
        this.isEuropean = isEuropean;
        this.isOnPlay = false;
        this.roundCount = 0;
    }

    startRound() {
        this.isOnPlay = true;
        this.triggerTimeout();
    }

    triggerTimeout() {
        this.timeOut = setTimeout(() => {
            console.log("Time out. No more Bets");
            this.resetTimeOut();
            let result = wheel.GetNumber(this.room, this.roundCount, this.isEuropean);
            console.log(result);
        }, this.waitTime * 1000);
    }

    getResult() {
        let result = -9999;
        if (this.isEuropean) {
            result = wheel.GetEuropeanNumber(this.room, this.roundCount);
        } else {
            result = wheel.GetAmericanNumber(this.room, this.roundCount);
        }

        //temporal
        this.isOnPlay = false;
        //
        return result;
    }

    roundFinished() {
        this.isOnPlay = false;
        this.roundCount++;
    }

    resetTimeOut() {
        if (typeof this.timeOut === 'object') {
            clearTimeout(this.timeOut);
        }
    }
};

Game.io = 0;
module.exports = Game;