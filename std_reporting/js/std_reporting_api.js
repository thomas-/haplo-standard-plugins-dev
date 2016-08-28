
var CanUseReportingApi = O.action("std:reporting:api:v0").
    title("Reporting: Access v0 API").
    allow("group", Group.ReportingAPI);

var sendJSON = function(E, data) {
    E.response.kind = 'json';
    E.response.body = (E.request.parameters.output === 'pretty') ?
        JSON.stringify(data, undefined, 2) :
        JSON.stringify(data);
};

// --------------------------------------------------------------------------

P.respond("GET", "/api/reporting/v0/collections", [
], function(E) {
    CanUseReportingApi.enforce();
    P.ensureCollectionsDiscovered();
    var collections = [];
    _.keys(P._collections).sort().forEach(function(name) {
        var c = P._collections[name];
        collections.push({
            name: c.name,
            description: c.description,
            categories: c.$categories,
            info: "/api/reporting/v0/collection/"+c.name
        });
    });
    sendJSON(E, {
        collections: collections
    });
});

// --------------------------------------------------------------------------

P.respond("GET", "/api/reporting/v0/collection", [
    {pathElement:0, as:"string"}
], function(E, name) {
    CanUseReportingApi.enforce();
    var collection = P.getCollection(name);
    if(!collection) { O.stop("Unknown collection: "+collection); }
    var facts = [];
    _.each(collection.$factDescription, function(description, name) {
        facts.push({
            name: name,
            type: collection.$factType[name],
            description: description
        });
    });
    sendJSON(E, {
        name: collection.name,
        description: collection.description,
        categories: collection.$categories,
        status: collection.isUpdatingFacts ? 'updating' : 'ready',
        facts: facts,
        data: "/api/reporting/v0/collection-data/"+collection.name
    });
});

// --------------------------------------------------------------------------

P.respond("GET", "/api/reporting/v0/collection-data", [
    {pathElement:0, as:"string"},
    {parameter:"at", as:"string", optional:true}
], function(E, name, atStr) {
    CanUseReportingApi.enforce();
    var collection = P.getCollection(name);
    if(!collection) { O.stop("Unknown collection: "+collection); }
    var columns = [];
    _.each(collection.$factDescription, function(description, name) {
        if(name !== 'ref') { columns.push(name); }
    });
    var relevantRefs = O.refdict();
    var dataAtTime = atStr ? (new XDate(atStr)).toDate() : undefined;
    var rows = _.map(collection.selectAllRowsAtTime(dataAtTime), function(row) {
        var r = [row.ref.toString(), row.ref.load().title];
        columns.forEach(function(k) {
            var v = row[k];
            if(v instanceof $Ref) {
                relevantRefs.set(v,true);
                r.push(v.toString());
            } else {
                r.push(v);
            }
        });
        return r;
    });
    var refLookup = {};
    relevantRefs.each(function(ref,v) {
        refLookup[ref.toString()] = ref.load().title;
    });
    sendJSON(E, {
        name: collection.name,
        status: collection.isUpdatingFacts ? 'updating' : 'ready',
        at: (new XDate(dataAtTime || new Date())).toISOString(),
        columns: ['ref','objectTitle'].concat(columns),
        rows: rows,
        refs: refLookup
    });
});
