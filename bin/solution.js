#!/usr/bin/env node

var _ = require('underscore');
var async = require('async');
var request = require('request');

function deckString(deck) {
  if (deck.length === 0) {
    return "empty";
  }

  return deck.join(" ");
}

function logGame(game) {
  console.log("");
  console.log("Player one: " + deckString(game.decks.one) + ", collection: " + deckString(game.collections.one));
  console.log("Player two: " + deckString(game.decks.two) + ", collection: " + deckString(game.collections.two));
  console.log("Center: " + deckString(game.center));
}

function url(path) {
  return 'http://0.0.0.0:3000/' + path.replace(/^\/?/, '');
}

function jsonCallback(cb) {
  return function(err, res, body) {
    if (err) {
      return cb(err);
    }

    if (res.statusCode !== 200) {
      return cb("Got unexpected status code " + res.statusCode);
    }

    console.log(body);

    if (typeof body === 'undefined' || !body ||
        typeof body.success === 'undefined' || body.success !== true) {
      return cb("Got 200 without success true", body);
    }

    cb(null, body.data);
  }
}

function get(route, cb) {
  console.log("GET " + url(route));
  request({
    url: url(route),
    method: 'get',
    json: true
  }, jsonCallback(cb));
}

function post(route, data, cb) {
  console.log("POST " + url(route));
  request({
    url: url(route),
    method: 'post',
    body: data,
    json: true
  }, jsonCallback(cb));
}

function startGame(game, gameParams, cb) {
  post('games', gameParams, function(err, data) {
    if (err) {
      return cb(err);
    }

    game.id = data.id;
    game.decks.one = data.one;
    game.decks.two = data.two;
    game.state = 'started';
    return cb(null, game);
  });
}

FACES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function cardValue(card) {
  return FACES.indexOf(card.split("").slice(0,-1).join(""));
};

function stoppingCondition(game) {
  if (game.decks.one.length === 0 && game.collections.one.length === 0 &&
      game.decks.two.length === 0 && game.collections.two.length === 0) {
    console.log('stoppingCondition: tie');
    game.state = 'tie';
    return true;
  } else if (game.decks.one.length === 0 && game.collections.one.length === 0) {
    console.log('stoppingCondition: player_two_win');
    game.state = 'player_two_win';
    return true;
  } else if (game.decks.two.length === 0 && game.collections.two.length === 0) {
    console.log('stoppingCondition: player_one_win');
    game.state = 'player_one_win';
    return true;
  } else if (game.decks.one.length === 0 && game.collections.one.length > 0) {
    console.log('stoppingCondition: shuffle_required');
    game.state = 'shuffle_required';
    return true;
  } else if (game.decks.two.length === 0 && game.collections.two.length > 0) {
    console.log('stoppingCondition: shuffle_required');
    game.state = 'shuffle_required';
    return true;
  } else {
    return false;
  }
}

function playTurn(game) {
  if (stoppingCondition(game)) {
    return;
  }

  if (game.warCardsLeft > 0) {
    return playWar(game);
  }

  var oneCard = game.decks.one.shift();
  var twoCard = game.decks.two.shift();

  game.center.push(oneCard);
  game.center.push(twoCard);

  if (cardValue(oneCard) > cardValue(twoCard)) {
    game.collections.one = game.collections.one.concat(game.center);
    game.center = [];
    return playTurn(game);
  }

  if (cardValue(oneCard) < cardValue(twoCard)) {
    game.collections.two = game.collections.two.concat(game.center);
    game.center = [];
    return playTurn(game);
  }

  playWar(game);
}

function playWar(game) {
  if (game.warCardsLeft === 0) {
    game.warCardsLeft = 3;
  }

  while (game.warCardsLeft > 0) {
    if (stoppingCondition(game)) {
      return;
    }

    game.center.push(game.decks.one.shift());
    game.center.push(game.decks.two.shift());
    game.warCardsLeft -= 1;
  }

  playTurn(game);
}

function declareWinner(game, player, cb) {
  logGame(game);
  console.log("DECLARE WINNER: " + player);
  get('games/' + game.id + '/declare_winner/' + player, cb);
}

function shuffle(game, cb) {
  var message = "SHUFFLING";
  var params = {};

  if (game.decks.one.length === 0) {
    params.one = game.collections.one;
    message += " ONE";
  }
  if (game.decks.two.length === 0) {
    params.two = game.collections.two;
    message += " TWO";
  }

  logGame(game);
  console.log(message);
  post('games/' + game.id + '/shuffle_deck', params, function(err, data) {
    if (err) {
      return cb(err);
    }

    if (data.one) {
      game.decks.one = data.one;
      game.collections.one = [];
    }

    if (data.two) {
      game.decks.two = data.two;
      game.collections.two = [];
    }

    playGame(game, cb);
  });
}

function playGame(game, cb) {
  logGame(game);
  console.log("RESUMING GAME PLAY");
  playTurn(game);

  if (game.state === 'tie') {
    return declareWinner(game, 'tie', cb);
  } else if (game.state === 'player_one_win') {
    return declareWinner(game, 'one', cb);
  } else if (game.state === 'player_two_win') {
    return declareWinner(game, 'two', cb);
  } else if (game.state === 'shuffle_required') {
    return shuffle(game, cb);
  }
}

async.waterfall([
  function(cb) {
    cb(null, {
      id: null,
      state: 'empty',
      warCardsLeft: 0,
      decks: {
        one: [],
        two: [],
      },
      collections: {
        one: [],
        two: [],
      },
      center: []
    });
  },
  function(game, cb) {
    startGame(game, {
      name: 'Andrew Pariser',
      email: 'pariser@gmail.com',
      // randomSeed: [ -1442853841, 1042084053, 284344918, 205626656, -1336090688, 1266982498, 707777642, 1032704158, -1363379118, 40740609, 1863088548, 1676516959, -2002991749, 938131605, 1405472820, 1108618716 ],
      // randomIndex: 0
    }, cb);
  },
  function(game, cb) {
    playGame(game, cb);
  }
], function(err, game) {
  console.log('waterfall finished!');

  if (err) {
    console.log('err', err);
  }
  // console.log('res', res);
  console.log('game', game);
});
