Package.describe({
  name: 'krt:elasticsearch',
  summary: "Sync collections with ElasticSearch and search them. Heavy influence from easy-search",
  version: "0.2.2",
  documentation: null
});

Npm.depends({
  'elasticsearch': '8.2.0'
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@1.2');

  api.use([
    'underscore',
    'livedata',
    'mongo-livedata',
    'meteor',
    'meteor-platform',
    'krt:core@0.1.4'
  ], ['client', 'server']);

  api.use([
    'templating',
    'reactive-var'
  ], 'client');

  api.imply([
    'krt:core'
  ]);

  api.addFiles([
    'namespaces.js',
    'lib/elasticsearch-common.js'
  ], ['client','server']);

  api.addFiles([
    'lib/elasticsearch-server.js'
  ],'server');

  api.addFiles([
    'lib/elasticsearch-client.html',
    'lib/elasticsearch-client.js'
  ],'client');
});
