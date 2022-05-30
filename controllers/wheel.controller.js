const wheelController = {};
var FisherYattes = require('fisher-yates');
var MersenneTwister = require('mersenne-twister');
const { hash } = require('enigma-hash');
const EuroNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];
const AmericanNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37]; // 37 is 00

CreateEuropeanDeck = (customSeed, customKey) => {
    const hashValue = hash(customSeed, 'sha256', 'hex', customKey)
    const numHex = parseInt('0x' + hashValue.substr(0, 4));
    const rgn = new MersenneTwister(numHex);

    let deck = FisherYattes(EuroNumbers, () => { return rgn.random(); });
    return deck;
}

CreateAmericanDeck = (customSeed, customKey) => {
    const hashValue = hash(customSeed, 'sha256', 'hex', customKey)
    const numHex = parseInt('0x' + hashValue.substr(0, 4));
    const rgn = new MersenneTwister(numHex);

    let deck = FisherYattes(AmericanNumbers, () => { return rgn.random(); });
    return deck;
}

CreateKey = () => {
    let key = Math.random().toString(36).slice(-10);
    console.log(key);
    return key;
}

wheelController.GetAmericanNumber = (roomName, counter) => {
    // Get the shuffled deck of American numbers
    const mainDeck = CreateAmericanDeck(roomName, CreateKey() + counter);
    // Return the first value
    return mainDeck[0];
}
wheelController.GetEuropeanNumber = (roomName, counter) => {
    // Get the shuffled deck of European numbers
    const mainDeck = CreateEuropeanDeck(roomName, CreateKey() + counter);
    // Return the first value
    return mainDeck[0];
}

module.exports = wheelController;