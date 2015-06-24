var searchResults = {};
KRT.ElasticSearch.junk = function() {
	return searchResults;
};

Template.krtElasticSearchInput.onCreated(function() {
	this._searchResults = new ReactiveVar(null);
	searchResults[this.data.name] = this;
});

Template.krtElasticSearchInput.onDestroyed(function() {
	searchResults[this.data.name] = undefined;
});

var keyup = _.throttle(function(self, ev, tmpl) {
	var searchString = tmpl.$('input').val().trim();
	var options = {};
	if (self.types) options.type = self.types;
	KRT.ElasticSearch.search(self.index, searchString, function(err,res) {
		if (!err) {
			tmpl._searchResults.set(res);
		}
	});
}, 500);

Template.krtElasticSearchInput.events({
	'keyup input': function(ev, tmpl) {
		keyup(this, ev, tmpl);
	}
});

Template.krtElasticSearchResults.helpers({
	results: function() {
		var self = this;
		if (searchResults[self.name] && searchResults[self.name]._searchResults) {
			var results = searchResults[self.name]._searchResults.get();
			if (results) {
				return _(results.results).map(function (result, index) {
					if (!!self.meta) {
						return KRT.ElasticSearch.getMetaResult(index, results);
					} else {
						return KRT.ElasticSearch.getMetaResult(index, results).source;
					}
				});
			}
		}
	}
});
