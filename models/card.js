module.exports = (function() {
  var FACES = [
    '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
  ];
  var SUITS = [
    '♤', '♧', '♡', '♢'
  ];

  var Card = {};

  Card.value = function(card) {
    if (typeof card !== 'string') {
      throw new Error('Invalid card ' + card);
    }

    var face = card.split('').slice(0,-1).join('');
    var suit = card[card.length - 1];

    var faceIndex = FACES.indexOf(face);

    if (faceIndex === -1) {
      throw new Error('Invalid face ' + face + ' from card ' + card);
    }

    if (SUITS.indexOf(suit) === -1) {
      throw new Error('Invalid suit ' + suit + ' from card ' + card);
    }

    return faceIndex;
  };

  Card.collectionString = function(cards) {
    if (cards.length === 0) {
      return "empty";
    }

    return cards.join(" ");
  };

  Card.FACES = FACES;
  Card.SUITS = SUITS;

  var CARDS = (function() {
    var cards = [];

    SUITS.forEach(function(suit) {
      FACES.forEach(function(face) {
        cards.push(face + suit);
      })
    });

    return cards;
  }());

  Card.CARDS = CARDS;

  return Card;
}());
