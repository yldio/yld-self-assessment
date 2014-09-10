angular.module("selfAssessment",["ngRoute"])
.config(routeConfig)
.controller("connect", ConnectCtrl)
.controller("app", AppCtrl)
.factory("Trello", trello)
.factory("cards", cards)
.filter("backticks", backticks)
.filter("toCheck", toCheck)

.controller("lists", ListsCtrl)


function routeConfig($routeProvider) {
  $routeProvider
    .when("/", {
      templateUrl: "home.html",
    })
    .when("/feedback", {
      templateUrl: "feedback.html",
    })
    .when("/checklists", {
      templateUrl: "areas.html",
    })
}


function AppCtrl($scope, $location) {
  $scope.trello = { authorised: false };

  var trelloDefaults = {
    name: "YLD self-assessment",
    success: onAuthorize,
    scope: { write: true, read: true }
  };

  Trello.authorize(_.defaults({
    interactive: false,
  }, trelloDefaults));

  $scope.connect = function() {
    Trello.authorize(_.defaults({
      type: "popup",
    }, trelloDefaults));
  }

  $scope.viewing = function(section) {
    return $location.path().match(section);
  }

  function onAuthorize() {
    $scope.trello.authorised = true;
    $location.path("/checklists");
  }
}

function ConnectCtrl($scope) {
}


function ListsCtrl($scope, cards) {
  $scope.cards = cards.get();

  $scope.cards.$promise.then(function() {
    $scope.active = $scope.cards[0];
  });

  $scope.select = function(card) {
    $scope.active = card;
  }

  $scope.checked = function() {
    return cards.checked.apply(null, arguments);
  }
}


function cards($q, Trello) {

  return {
    get: function() {
      var prom = Trello.$get("members/me/boards").then(function(boards) {
        var board = _.find(boards, function(b) {
          return b.idOrganization === "53263733e3625d946507067c" && /Self/.test(b.name);
        });
        if(!board) throw new Error("Missing board");
        return board;
      }).then(function(board) {
        return $q.all({
          board: board,
          cards: Trello.$get("boards/" + board.id + "/cards"),
          checklists: Trello.$get("boards/" + board.id + "/checklists")
        });
      })
      .then(function(results) {
        var byId = _.reduce(results.checklists, function(all, cl) {
          all[cl.idCard] = cl.checkItems;
          all[cl.idCard].id = cl.id;
          return all;
        }, {});
        _.each(results.cards, function(card) {
          card.checklist = byId[card.id];
        });
        return results.cards;
      });

      return arrayFromPromise(prom);
    },
    checked: function(card, checklist, item) {
      item.changing = true;
      Trello.$put("/cards/" + card.id + "/checklist/" + checklist.id + "/checkItem/" + item.id + "/state", { value: item.checked })
        .then(function() {
          item.changing = false;
        })
    }
  }
}

function trello($q) {

  ["get", "post", "rest", "put", "delete"].forEach(function(method) {
    Trello["$" + method] = function() {
      var args = [].slice.call(arguments);
      return $q(function(resolve, reject) {
        Trello[method].apply(Trello, args.concat([resolve, reject]));
      });
    };
  });

  return Trello;

}

function arrayFromPromise(promise) {
  var array = [];
  array.$promise = promise;
  promise.then(function(projects) {
    projects.forEach(function(r) {
      array.push(r);
    });
  });
  return array;
}
function objectFromPromise(promise, existingAttrs) {
  var obj = _.defaults({$promise: promise}, existingAttrs);
  promise.then(function(r) {
    _.extend(obj, r); 
  });
  return obj;
}

function backticks($sce) {
  return function(input) {
    return $sce.trustAsHtml((input.replace(/`([^`]+)`/g, function(_p, phrase) {
      return "<code class=inline>" + phrase + "</code>";
    })));
  }
}

function toCheck() {
  return function(input) {
    return input ? "✓" : "✗";
  }
}
