'use strict';

var ElasticSearch = Npm.require('elasticsearch'),
	Future = Npm.require('fibers/future');

var ElasticSearchClient;

var defaultConfig = {
	host: 'localhost:9200'
};

var config = _.extend({}, defaultConfig);

KRT.ElasticSearch.config = function(newConfig) {
	if (typeof newConfig !== 'undefined') {
		check(newConfig, Object);
		config = _.extend({}, defaultConfig, newConfig);
		ElasticSearchClient = new ElasticSearch.Client(config);
	}
	return config;
};

/**
 * Writes a document to an ElasticSearch index
 * @param name
 * @param doc
 * @param id
 * @param type
 */
function writeToIndex(name, doc, id, type) {
	ElasticSearchClient.index({
		index: name.toLowerCase(),
		type: type,
		id: id,
		body: doc
	}, function(err, data){
		if (err) {
			console.log('Error adding document');
			console.log(err);
		}
	});
}

/**
 * Stringify object fields for insertion into ElasticSearch
 * @param doc
 * @return {{}}
 */
function getESFields(doc) {
	var newDoc = {};
	_.each(doc, function (value, key) {
		newDoc[key] = _.isObject(value) && !_.isArray(value) && !_.isDate(value) ? JSON.stringify(value) : value;
	});
	return newDoc;
}

/**
 * Create search index (Server only)
 * @param indexName
 * @param options
 * @param type
 * @private
 */
KRT.ElasticSearch._createSearchIndex = function(indexName, options, type) {

	// Create the Elasticsearch client if needed
	if (typeof ElasticSearchClient === 'undefined') {
		KRT.ElasticSearch.config(defaultConfig);
	}

	indexName = indexName.toLowerCase();

	options.collections[type].find().observeChanges({
		added: function(id, fields) {
			//console.log('Added:', id);
			writeToIndex(indexName, getESFields(fields), id, type);
		},
		changed: function(id) {
			//console.log('Changed:',id);
			writeToIndex(indexName, getESFields(options.collection[type].findOne(id)), id, type);
		},
		removed: function(id) {
			//console.log('Removed:',id);
			ElasticSearchClient.delete({
				index: indexName,
				type: type,
				id: id
			}, function(err, res) {
				if (err) {
					console.log('Error removing ' + id + ' from ElasticSearch');
					console.log(err);
				}
			});
		}
	});
};

/**
 * Search an ElasticSearch index (Server only)
 * @param name
 * @param bodyObj
 * @param options
 * @return {*}
 * @private
 */
KRT.ElasticSearch._search = function(name, bodyObj, options) {
	var fut = new Future();

	// Make sure index names are lowercase
	name = _(name).map(function(n){
		return n.toLowerCase();
	});

	ElasticSearchClient.search({
		index: name,
		body: bodyObj,
		size: options.limit,
		from: options.skip
	}, function(err, data){
		if (err) {
			console.log('Error while searching index');
			console.log(err);
			return [];
		}

		data = extractJSONData(data);

		fut['return'](data);
	});

	return fut.wait();
};

// Define Meteor methods
Meteor.methods({
	krtElasticSearch: function(name, bodyObj, options) {
		check(name, Array);
		check(bodyObj, Object);
		check(options, Object);
		return KRT.ElasticSearch._search(name, bodyObj, options);
	}
});

/**
 * Parses the search results and returns the results with meta and total found
 * @param data
 * @return {{results: (*|Array|any), meta: {results: (*|Array|any), timed_out: *, took: *}, total: *}}
 */
function extractJSONData(data) {
	data = _.isString(data) ? JSON.parse(data) : data;

	var results = _.map(data.hits.hits, function (resultSet) {
		var field = '_source';

		if (resultSet['fields']) {
			field = 'fields';
		}

		resultSet[field]['_id'] = resultSet['_id'];

		return resultSet[field];
	});

	var meta = {
		results: _(data.hits.hits).map(function(obj){
			return _(obj).omit(['_source','fields']);
		}),
		timed_out: data.timed_out,
		took: data.took
	};

	return {
		results: results,
		meta: meta,
		total: data.hits.total
	};
}
