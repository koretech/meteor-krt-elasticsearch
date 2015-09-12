/** POLYFILL **/
if (!Array.prototype.findIndex) {
	Array.prototype.findIndex = function(predicate) {
		if (this == null) {
			throw new TypeError('Array.prototype.findIndex called on null or undefined');
		}
		if (typeof predicate !== 'function') {
			throw new TypeError('predicate must be a function');
		}
		var list = Object(this);
		var length = list.length >>> 0;
		var thisArg = arguments[1];
		var value;

		for (var i = 0; i < length; i++) {
			value = list[i];
			if (predicate.call(thisArg, value, i, list)) {
				return i;
			}
		}
		return -1;
	};
}

var indexes = {};

var defaultIndexOptions = {
	type: 'default'
};

var defaultSearchOptions = {
	field: ['_all'],
	skip: 0,
	limit: 10,
	sort: function() {
		return ['_score'];
	},
	query: function(searchString, options) {
		return {
			bool: {
				should: [
					{
						multi_match: {
							fields: options.field,
							type: 'phrase_prefix',
							query: searchString
						}
					},
					{
						query_string: {
							fields: options.field,
							query: searchString
						}
					},
					{
						fuzzy_like_this: {
							like_text: searchString,
							fuzziness: "AUTO",
							boost: 0.5,
							fields: options.field
						}
					}
				]
			}
		};
	}
};

KRT.ElasticSearch.defaultSearchOptions = function() {
	return _.clone(defaultSearchOptions);
};

/**
 * Defines a search index (Both)
 * @param indexName
 * @param options
 */
KRT.ElasticSearch.defineSearchIndex = function(indexName, options) {
	check(indexName, String);
	check(options, Object);
	check(options.type, String);

	// If this index doesn't exist in the registry, create it
	if (!indexes[indexName]) {
		indexes[indexName] = {
			index: indexName,
			collections: {}
		};
	}

	// Associate the collection with the type
	indexes[indexName].collections[options.type] = options.collection;

	if (Meteor.isServer) {
		KRT.ElasticSearch._createSearchIndex(indexName, indexes[indexName], options.type);
	}

};

/**
 * Defines a search index based off a collection (Both)
 * @param indexName Uses the collection name if indexName not specified
 */
Meteor.Collection.prototype.defineSearchIndex = function(indexName) {
	var options = _.clone(defaultIndexOptions);

	if (indexName) {
		options.type = this._name;
	} else {
		indexName = this._name;
	}

	options.collection = this;

	KRT.ElasticSearch.defineSearchIndex(indexName, options);
};

/**
 * Searches an index related to a collection
 * @param searchString
 * @param options
 * @param callback
 */
Meteor.Collection.prototype.search = function(searchString, options, callback) {
	var indexName = this._name;

	if (options && options.index) {
		indexName = options.index;
		options.type = this._name;
	}

	KRT.ElasticSearch.search(indexName, searchString, options, callback);
};

/**
 * Searches an index
 * @param indexName
 * @param searchString
 * @param options
 * @param callback
 * @return {*}
 */
KRT.ElasticSearch.search = function(indexName, searchString, options, callback) {
	// Make sure indexName ends up being an array (for searching multiple indexes)
	if (_.isString(indexName)) {
		indexName = [indexName];
	}
	check(indexName, Array);

	// Make sure the indexes exist in the registry
	check(indexName, Match.Where(function(x){
		return _(x).all(function(y){
			return !!indexes[y];
		});
	}));

	// Allows the options argument to be optional
	if (arguments.length == 3 && _(options).isFunction()) {
		callback = options;
		options = {};
	}

	// Make search search string is defined
	searchString = searchString || '';

	// Build the options based off the defaults
	options = _.extend({}, defaultSearchOptions, options);

	// Build the body Query DSL object
	var bodyObj = buildBodyObject(searchString, options);

	if (Meteor.isClient) {
		if (callback) {
			Meteor.call('krtElasticSearch', indexName, bodyObj, options, callback);
		} else {
			Meteor.call('krtElasticSearch', indexName, bodyObj, options, function(err,res){
				console.log(res);
			});
		}
	} else {
		return KRT.ElasticSearch._search(indexName, bodyObj, options);
	}
};

/**
 * Builds the Query DSL object
 * @param searchString
 * @param options
 * @return {*}
 */
function buildBodyObject(searchString, options) {
	// Start by calling the custom query function
	var bodyObj = {
		query: options.query(searchString, options)
	};

	if (!bodyObj.query) {
		return null;
	}

	// If the type is specified, filter by it
	if (options.type) {
		var q = bodyObj.query;
		bodyObj = {
			query: {
				filtered: {
					query: q,
					filter: {
						type: {
							value: options.type
						}
					}
				}
			}
		};
	}

	// Add the sort
	bodyObj.sort = options.sort(searchString, options);

	// Allow modifications directly to the body object
	if (options.body && _.isFunction(options.body)) {
		bodyObj = options.body(bodyObj, options);
	}
	return bodyObj;
}

/**
 * Retrieves an index from the registry
 * @param indexName
 * @return {*}
 */
KRT.ElasticSearch.getIndex = function(indexName) {
	return indexes[indexName];
};

/**
 * Retrieves a collection from a specific index in the registry
 * @param indexName
 * @param type
 * @return {*}
 */
KRT.ElasticSearch.getIndexCollection = function(indexName, type) {
	type = type || 'default';

	if (indexes[indexName] && indexes[indexName].collections[type]) {
		return indexes[indexName].collections[type];
	}
	return null;
};

KRT.ElasticSearch.getMetaResult = function(id, results) {
	check(results.meta, Object);
	check(results.results, Array);
	check(id, Match.OneOf(Number, String));

	var pos;
	if (_.isNumber(id)) {
		pos = id;
	} else if (_.isString(id)) {
		pos = results.results.findIndex(function(obj){
			return obj._id === id;
		});
	}

	var metaResult = results.meta.results[pos];

	var collection = KRT.ElasticSearch.getIndexCollection(metaResult._index, metaResult._type);

	return {
		source: (collection._transform) ? collection._transform(results.results[pos]) : results.results[pos],
		meta: metaResult,
		collection: collection
	};
};
