var searchResults = {};
KRT.ElasticSearch.junk = function() {
	return searchResults;
};

Template.krtElasticSearchInput.onCreated(function() {
	var self = this;

	var opts = KRT.ElasticSearch.defaultSearchOptions();
	if (self.data.types) opts.type = self.data.types;

	self._searchResults = new ReactiveVar(null);
	self._searchOptions = new ReactiveVar(opts);
	self._searchText = new ReactiveVar(null);
	searchResults[self.data.name] = self;

	this.autorun(function(){
		var options = self._searchOptions.get();
		var text = self._searchText.get();
		KRT.ElasticSearch.search(self.data.index, text, options, function(err,res) {
			if (!err) {
				self._searchResults.set(res);
				//console.log('searching', text, options, res);
			}
		});
	});
});

Template.krtElasticSearchInput.onDestroyed(function() {
	searchResults[this.data.name] = undefined;
});

var keyup = _.throttle(function(self, ev, tmpl) {
	var searchString = tmpl.$('input').val().trim();
	var opts = tmpl._searchOptions.get();
	opts.skip = 0;
	tmpl._searchOptions.set(opts);
	tmpl._searchText.set(searchString);
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

Template.krtElasticSearchPagination.events({
	'click .prev': function(ev, tmpl) {
		updateOptions(this.name, function(opts){
			opts.skip -= opts.limit;
			if (opts.skip < 0) opts.skip = 0;
			return opts;
		});
		$('html,body').animate({ scrollTop: 0 }, 'slow');
	},
	'click .next': function(ev, tmpl) {
		updateOptions(this.name, function(opts, res){
			if ((opts.skip + opts.limit) >= res.total) return opts;
			opts.skip += opts.limit;
			return opts;
		});
		$('html,body').animate({ scrollTop: 0 }, 'slow');
	},
	'click .page': function(ev, tmpl) {
		var page = $(ev.currentTarget).data('page');
		if (page >= 0) {
			updateOptions(this.name, function(opts) {
				opts.skip = page * opts.limit;
				return opts;
			});
		}
		$('html,body').animate({ scrollTop: 0 }, 'slow');
	}
});

function updateOptions(name, callback) {
	var searchTmpl = (searchResults[name]) ? searchResults[name] : null;
	if (searchTmpl) {
		var options = searchTmpl._searchOptions.get();
		var res = searchTmpl._searchResults.get();
		options = callback(options, res);
		searchTmpl._searchOptions.set(options);
	}
}

Template.krtElasticSearchPagination.helpers({
	pages: function() {
		var searchTmpl = (searchResults[this.name]) ? searchResults[this.name] : null;
		if (searchTmpl) {
			var res = searchTmpl._searchResults.get();
			var opts = searchTmpl._searchOptions.get();
			if (res) {
				var numActualPages = res.total / opts.limit;

				//var numPages = (numActualPages > 10) ? 10 : numActualPages;
				var numPages = numActualPages;

				var currentPage = Math.floor(opts.skip / opts.limit);

				// Build the pages array (only until 10 pages)
				var pages = [];
				for (var i=0;i<numPages;i++) {
					var page = {
						text: '' + (i+1),
						num: i,
						class: null,
						name: this.name
					};
					if (i==currentPage) page['class'] = 'active';
					pages.push(page);
				}

				//// Add an ellipsis if more than 10 pages returned
				//if (numActualPages > 10) {
				//	pages.push({
				//		text: '&hellip;',
				//		num: -1,
				//		class: null
				//	});
				//}

				return pages;
			}
		}
		return [];
	}

});
