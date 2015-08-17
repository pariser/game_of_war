var _ = require('underscore');
var async = require('async');
var mongoose = require('mongoose');
var Random = require('random-js');
var Card = require('./card');

var Game;

var TIE_GAME = 'tie_game';
var PLAYER_ONE_WIN = 'player_one_win';
var PLAYER_ONE_SHUFFLE_REQUIRED = 'player_one_shuffle_required';
var PLAYER_TWO_WIN = 'player_two_win';
var PLAYER_TWO_SHUFFLE_REQUIRED = 'player_two_shuffle_required';
var BOTH_PLAYERS_SHUFFLE_REQUIRED = 'both_players_shuffle_required';

if (mongoose.models.Game) {
  Game = mongoose.models.Game;
} else {

  var gameSchema = new mongoose.Schema({
    createdAt: Date,
    updatedAt: Date,
    completedAt: Date,

    name: String,
    email: String,

    state: String,

    randomSeed: Array,
    randomIndex: Number,

    playerOneDeck: Array,
    playerTwoDeck: Array,
    playerOneCollection: Array,
    playerTwoCollection: Array,

    playCollection: Array,
    warDiscardsLeft: Number,

    completed: Boolean,
    playedSuccessfully: Boolean,
    failedReason: String
  });

  gameSchema.pre('save', function(next) {
    // Set updatedAt and createdAt timestamps
    var now = new Date();
    this.updatedAt = now;
    if (!this.createdAt) {
      this.createdAt = now;
    }
    if (this.completed && !this.completedAt) {
      this.completedAt = now;
    }

    // Save the random number generator's state.
    // This will initialize the random number generator if it has not yet been initialized.
    this.randomIndex = this.rg().getUseCount();

    next();
  });

  // --------
  // Public API for Gameplay

  gameSchema.methods.startGame = function(cb) {
    if (this.exitOnLockedGame(cb)) {
      return;
    }

    if (this.state) {
      return this.failedGame("Unexpected game action", cb);
    }

    // clone the cards
    var originalDeck = Card.CARDS.slice(0);

    // shuffle the cards
    Random.shuffle(this.rg(), originalDeck);

    var playerOneDeck = originalDeck.slice(0);
    var playerTwoDeck = playerOneDeck.splice(0, 26);

    this.playerOneDeck = playerOneDeck.slice(0);
    this.playerTwoDeck = playerTwoDeck.slice(0);
    this.playerOneCollection = [];
    this.playerTwoCollection = [];

    this.logGameState();

    this.playToStoppingConditionSaveAndReturnData(cb, {
      id: this.id,
      one: playerOneDeck,
      two: playerTwoDeck
    });
  };

  gameSchema.methods.playerCollectionInvalid = function(player, deck, cb) {
    if (player === 'one' &&
        (this.playerOneCollection.length !== deck.length ||
         _.difference(this.playerOneCollection, deck).length > 0)) {
      cb(new Error("Did not receive correct cards in player one collection"));
      return true;
    }

    if (player === 'two' &&
        (this.playerTwoCollection.length !== deck.length ||
         _.difference(this.playerTwoCollection, deck).length > 0)) {
      cb(new Error("Did not receive correct cards in player two collection"));
      return true;
    }
  };

  gameSchema.methods.shuffleDeck = function(data, cb) {
    if (this.exitOnLockedGame(cb)) {
      return;
    }

    var suppliedPlayerOneDeck = _.has(data, 'one');
    var suppliedPlayerTwoDeck = _.has(data, 'two');

    if (this.state === BOTH_PLAYERS_SHUFFLE_REQUIRED) {
      if (!suppliedPlayerOneDeck) {
        return this.failedGame("Didn't supply player one deck", cb);
      }

      if (!suppliedPlayerTwoDeck) {
        return this.failedGame("Didn't supply player two deck", cb);
      }

      if (this.playerCollectionInvalid('one', data.one, cb)) {
        return this.failedGame("Invalid collection for player one", cb);
      }

      if (this.playerCollectionInvalid('two', data.two, cb)) {
        return this.failedGame("Invalid collection for player two", cb);
      }

      var shuffledPlayerOneDeck = this.playerOneCollection.slice(0);
      var shuffledPlayerTwoDeck = this.playerTwoCollection.slice(0);

      Random.shuffle(this.rg(), shuffledPlayerOneDeck);
      Random.shuffle(this.rg(), shuffledPlayerTwoDeck);

      this.playerOneDeck = shuffledPlayerOneDeck.slice(0);
      this.playerTwoDeck = shuffledPlayerTwoDeck.slice(0);
      this.playerOneCollection = [];
      this.playerTwoCollection = [];

      this.logGameState();

      return this.playToStoppingConditionSaveAndReturnData(cb, {
        one: shuffledPlayerOneDeck,
        two: shuffledPlayerTwoDeck
      });
    } else if (this.state === PLAYER_ONE_SHUFFLE_REQUIRED) {
      if (!suppliedPlayerOneDeck) {
        return this.failedGame("Didn't supply player one deck", cb);
      }

      if (this.playerCollectionInvalid('one', data.one, cb)) {
        return this.failedGame("Invalid collection for player one", cb);
      }

      var shuffledPlayerOneDeck = this.playerOneCollection.slice(0);
      Random.shuffle(this.rg(), shuffledPlayerOneDeck);

      this.playerOneDeck = shuffledPlayerOneDeck.slice(0);
      this.playerOneCollection = [];

      this.logGameState();

      return this.playToStoppingConditionSaveAndReturnData(cb, {
        one: shuffledPlayerOneDeck
      });
    } else if (this.state === PLAYER_TWO_SHUFFLE_REQUIRED) {
      if (!suppliedPlayerTwoDeck) {
        return this.failedGame("Didn't supply player two deck", cb);
      }

      if (this.playerCollectionInvalid('two', data.two, cb)) {
        return this.failedGame("Invalid collection for player two", cb);
      }

      var shuffledPlayerTwoDeck = this.playerTwoCollection.slice(0);
      Random.shuffle(this.rg(), shuffledPlayerTwoDeck);

      this.playerTwoDeck = shuffledPlayerTwoDeck.slice(0);
      this.playerTwoCollection = [];

      this.logGameState();

      return this.playToStoppingConditionSaveAndReturnData(cb, {
        two: shuffledPlayerTwoDeck
      });
    } else {
      this.failedGame("Neither player needs to shuffle right now", cb);
    }
  };

  gameSchema.methods.declareWinner = function(player, cb) {
    if (this.exitOnLockedGame(cb)) {
      return;
    }

    if (player !== 'one' && player !== 'two' && player !== 'tie') {
      return this.failedGame("Unexpected arguments", cb);
    }

    if (this.state === TIE_GAME && player === 'tie') {
      return this.passedGame(cb);
    }

    if (this.state === PLAYER_ONE_WIN && player === 'one') {
      return this.passedGame(cb);
    }

    if (this.state === PLAYER_TWO_WIN && player === 'two') {
      return this.passedGame(cb);
    }

    this.failedGame("Unexpected game action", cb);
  };

  // --------

  gameSchema.methods.rg = function() {
    if (this.randomSeed.length === 0) {
      this.randomSeed = Random.generateEntropyArray();
    }

    if (typeof this._rg === 'undefined' || !this._rg) {
      this._rg = Random.engines.mt19937();
      this._rg.seedWithArray(this.randomSeed);

      if (typeof this.randomIndex === 'undefined') {
        this.randomIndex = this._rg.getUseCount();
      } else {
        this._rg.discard(this.randomIndex);
      }
    }

    return this._rg;
  };

  gameSchema.methods.playToStoppingConditionSaveAndReturnData = function(cb, data) {
    var self = this;

    async.waterfall([
      function(cb) {
        self.playToStoppingCondition(cb);
      },
      function(stoppingCondition, cb) {
        self.state = stoppingCondition;
        self.logGameEvent("Reached stopping condition: " + stoppingCondition);
        self.save(function(err) {
          cb(err);
        });
      }
    ], function(err) {
      if (err) {
        return cb(err);
      }

      cb(null, data);
    });
  };

  gameSchema.methods.playToStoppingCondition = function(cb) {
    while (true) {
      var method = 'playTurn';

      if (this.warDiscardsLeft && this.warDiscardsLeft > 0) {
        this.logGameEvent('resuming war with ' + this.warDiscardsLeft + ' cards to discard');
        method = 'resumeWar';
      }

      var stoppingCondition = this[method]();
      if (stoppingCondition) {
        return cb(null, stoppingCondition);
      }
    }
  };

  // Returns:
  //
  gameSchema.methods.playTurn = function() {
    var stoppingCondition;

    stoppingCondition = this.stoppingCondition();
    if (stoppingCondition) {
      return stoppingCondition;
    }

    var playerOneCard = this.playerOneDeck.shift();
    var playerTwoCard = this.playerTwoDeck.shift();

    this.playCollection.push(playerOneCard);
    this.playCollection.push(playerTwoCard);

    var playerOneValue = Card.value(playerOneCard);
    var playerTwoValue = Card.value(playerTwoCard);

    if (playerOneValue > playerTwoValue) {
      this.logGameEvent('player one takes cards: ' + playerOneCard + ', ' + playerTwoCard);
      this.playerOneCollection = this.playerOneCollection.concat(this.playCollection);
      this.playCollection = [];
    } else if (playerTwoValue > playerOneValue) {
      this.logGameEvent('player two takes cards: ' + playerOneCard + ', ' + playerTwoCard);
      this.playerTwoCollection = this.playerTwoCollection.concat(this.playCollection);
      this.playCollection = [];
    } else {
      this.logGameEvent('war: ' + playerOneCard + ', ' + playerTwoCard);
      stoppingCondition = this.playWar();
      if (stoppingCondition) {
        return stoppingCondition;
      }
    }
  };

  gameSchema.methods.playWar = function() {
    this.warDiscardsLeft = 3;
    return this.resumeWar();
  };

  gameSchema.methods.resumeWar = function() {
    while (this.warDiscardsLeft > 0) {
      var stoppingCondition = this.stoppingCondition();

      if (stoppingCondition) {
        return stoppingCondition;
      }

      this.logGameEvent('war discards: ' + this.playerOneDeck[0] + ', ' + this.playerTwoDeck[0]);
      this.playCollection.push(this.playerOneDeck.shift());
      this.playCollection.push(this.playerTwoDeck.shift());
      this.warDiscardsLeft -= 1;
    }

    return this.playTurn();
  };

  // TIE_GAME
  // PLAYER_ONE_WIN
  // PLAYER_ONE_SHUFFLE_REQUIRED
  // PLAYER_TWO_WIN
  // PLAYER_TWO_SHUFFLE_REQUIRED
  // BOTH_PLAYERS_SHUFFLE_REQUIRED

  gameSchema.methods.stoppingCondition = function() {
    if (this.playersTied()) {
      return TIE_GAME;
    }

    if (this.playerOneWon()) {
      return PLAYER_ONE_WIN;
    }

    if (this.playerTwoWon()) {
      return PLAYER_TWO_WIN;
    }

    var playerOneMustShuffle = this.playerOneMustShuffle();
    var playerTwoMustShuffle = this.playerTwoMustShuffle();

    if (playerOneMustShuffle && playerTwoMustShuffle) {
      return BOTH_PLAYERS_SHUFFLE_REQUIRED;
    } else if (playerOneMustShuffle) {
      return PLAYER_ONE_SHUFFLE_REQUIRED;
    } else if (playerTwoMustShuffle) {
      return PLAYER_TWO_SHUFFLE_REQUIRED;
    }
  };

  gameSchema.methods.playersTied = function() {
    return this.playerOneDeck.length === 0 &&
           this.playerOneCollection.length === 0 &&
           this.playerTwoDeck.length === 0 &&
           this.playerTwoCollection.length === 0;
  };

  gameSchema.methods.playerOneWon = function() {
    return this.playerTwoDeck.length === 0 &&
           this.playerTwoCollection.length === 0 &&
           (this.playerOneDeck.length > 0 || this.playerOneCollection.length > 0);
  };

  gameSchema.methods.playerTwoWon = function() {
    return this.playerOneDeck.length === 0 &&
           this.playerOneCollection.length === 0 &&
           (this.playerTwoDeck.length > 0 || this.playerTwoCollection.length > 0);
  };

  gameSchema.methods.playerOneMustShuffle = function() {
    return this.playerOneDeck.length === 0 &&
           this.playerOneCollection.length > 0;
  };

  gameSchema.methods.playerTwoMustShuffle = function() {
    return this.playerTwoDeck.length === 0 &&
           this.playerTwoCollection.length > 0;
  };

  gameSchema.methods.passedGame = function(cb) {
    this.playedSuccessfully = true;
    this.completed = true;
    this.save(function(err) {
      cb(err, {
        finished: true,
        success: true
      });
    });
  };

  gameSchema.methods.failedGame = function(reason, cb) {
    console.error('Failed game: ' + reason);
    this.playedSuccessfully = false;
    this.failedReason = reason;
    this.completed = true;
    this.save(function(err) {
      if (err) {
        return cb(err);
      }
      cb(null, {
        finished: true,
        success: false
      });
    });
  };

  gameSchema.methods.exitOnLockedGame = function(cb) {
    if (this.completed && this.playedSuccessfully) {
      cb("Cannot resume from a finished game.");
      return true;
    } else if (this.completed) {
      cb("Cannot resume from game after playing an incorrect move.");
      return true;
    }

    return false;
  };

  gameSchema.methods.logGameState = function() {
    console.log("");
    console.log("Game " + this.id + " in state: " + this.state);
    console.log("- Center: " + Card.collectionString(this.playCollection));
    console.log("- Player one deck: " + Card.collectionString(this.playerOneDeck) +
                ", collection: " + Card.collectionString(this.playerOneCollection));
    console.log("- Player two deck: " + Card.collectionString(this.playerTwoDeck) +
                ", collection: " + Card.collectionString(this.playerTwoCollection));
    console.log("");
  };

  gameSchema.methods.logGameEvent = function(message) {
    if (true) {
      console.log(message);
    }
  };

  Game = mongoose.model('Game', gameSchema);
}

module.exports = Game;
