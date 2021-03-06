const fetch = require('node-fetch')
const consts = require('./consts')

function mapEntryToMeta(engineUrl, entry, cb) {
	var videos = entry.files.sort(function(a, b) {
	// If it's not a torrent, sort videos; otherwise retain torrent order
	if (!entry.ih) try {
			var season = a.season - b.season;
			return season ? season : a.episode[0] - b.episode[0];
		} catch(e) {}
		return 0;
	}).map(mapFile.bind(null, engineUrl, entry))

	// We assume that one torrent may have only one IMDB ID for now: this is the only way to a decent UX now
	const imdbIdFile = entry.files.find(function(f) { return f.imdb_id })

	const genericMeta = {
		id: entry.itemId,
		type: 'other',
		name: (entry.files[0] && entry.files[0].parsedName) || entry.name,
		videos: videos,
		showAsVideos: true,
		// TODO: is there an easy way to pick the largest vid here? perhaps if we carry it in entry
		background: videos[0] && videos[0].thumbnail,
	}

	if (!imdbIdFile) {
		cb(null, genericMeta)
		return
	}

	// If we have IMDB ID, first we can fill in those, then try to get the actual object from cinemeta
	genericMeta.poster = consts.METAHUB_URL+'/poster/medium/'+imdbIdFile.imdb_id+'/img' 
	genericMeta.background = consts.METAHUB_URL+'/background/medium/'+imdbIdFile.imdb_id+'/img' 
	genericMeta.logo = consts.METAHUB_URL+'/logo/medium/'+imdbIdFile.imdb_id+'/img' 

	fetch(consts.CINEMETA_URL+'/meta/'+imdbIdFile.type+'/'+imdbIdFile.imdb_id+'.json')
	.then(function(resp) { return resp.json() })
	.then(function(resp) {
		if (!(resp && resp.meta)) throw 'no meta found'

		delete resp.meta.episodes
		delete resp.meta._id
		delete resp.meta.imdb_id
		Object.assign(resp.meta, {
			id: genericMeta.id,
			type: genericMeta.type,
			videos: videos,
			showAsVideos: true,
		})
		cb(null, resp.meta)
	})
	.catch(function(err) {
		// NOTE: not fatal, we can just fallback to genericMeta
		console.log('local-addon', imdbIdFile, err)

		cb(null, genericMeta)
	})
}

function mapFile(engineUrl, entry, f) {
	const stream = entry.ih ? {
		infoHash: entry.ih,
		fileIdx: f.idx,
		id: 'bt:' + entry.ih + '/' + f.idx,
		sources: entry.sources
	} : {
		id: 'file://'+f.path,
		url: 'file://'+f.path,
		subtitle: consts.STREAM_LOCALFILE_SUBTITLE,
	}

	return {
		id: stream.id,
		thumbnail: entry.ih ? engineUrl+'/'+entry.ih+'/'+f.idx+'/thumb.jpg' : null,
		title: f.name,
		publishedAt: entry.dateModified || new Date(),
		stream: stream,
	}
}

module.exports = mapEntryToMeta
