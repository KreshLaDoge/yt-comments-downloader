const args = process.argv;

if(args.length !== 7){
    console.error('USAGE: \n' +
        'nodejs script API_key sleep_between_requests channels_ids videos_per_channel_Limit comments_per_video_limit\n' +
        `Example:${args[0]} ${args[1]} 'AIzaSyBEdACltbBjeVZqHlZYBfLFPkJ5fN3M5cE' 10000 'UCQMhS3iDy2WD7JwXu6XniYA,UCwtr9zIfCyVS162bEF_s-TA,UC2BtzFqtduXt0txT6X_QAhA,UCqlZKBopA7F3aRshRs2tKlQ 1 1\n` +
        'sleep_between_requests: in milliseconds - For limiting requests rate to youtube API. If less then 1000 sets to 1000 (1s)\n' +
        'videos_per_channel_Limit: limits max videos count for testing purposes. 0 = unlimited\n' +
        'comments_per_video_limit: limits count of downloaded comments for each video. 0 = unlimited'
    );
    return 1;
}

const apiKey = args[2];
const sleepBetweenRequests = args[3];
const channelIDs = args[4].split(',');
const videosLimit = args[5];
const commentsLimit = args[6];

const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const sleepTime = sleepBetweenRequests > 1000 ? sleepBetweenRequests : 1000;

// const apiKey = 'AIzaSyBEdACltbBjeVZqHlZYBfLFPkJ5fN3M5cE';
// const channelIDs = ['UCQMhS3iDy2WD7JwXu6XniYA', 'UCwtr9zIfCyVS162bEF_s-TA', 'UC2BtzFqtduXt0txT6X_QAhA', 'UCqlZKBopA7F3aRshRs2tKlQ'];

const http = rateLimit(axios.create(), {maxRequests: 1, perMilliseconds: sleepTime});

async function getVideoIDsForChannel(videoCollection) {
    let videosIDs = [];
    if (videoCollection && videoCollection.data && videoCollection.data.items.length > 0) {
        const videoCollectionUploadsID = videoCollection.data.items[0].contentDetails.relatedPlaylists.uploads;
        let videosPage = await http.get(`https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${videoCollectionUploadsID}&key=${apiKey}&part=snippet&maxResults=50`);
        let nextPageToken = videosPage.data.nextPageToken;
        videosPage.data.items.forEach(video => {
            videosIDs.push(video.snippet.resourceId.videoId);
        });
        while (nextPageToken) {
            if(videosLimit && videosIDs.length > videosLimit){
                break;
            }
            // console.log(nextPageToken);
            // console.log('getting next page');
            videosPage = await http.get(`https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${videoCollectionUploadsID}&key=${apiKey}&part=snippet&maxResults=50&pageToken=${nextPageToken}`);
            videosPage.data.items.forEach(video => {
                videosIDs.push(video.snippet.resourceId.videoId);
            });
            nextPageToken = videosPage.data.nextPageToken;
        }
    }
    if(videosLimit){
        return videosIDs.slice(0, videosLimit);
    }
    return videosIDs;
}

async function getComments(videoID) {
    let commentsPage = await http.get(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${videoID}&key=${apiKey}&maxResults=100`);
    let nextPageToken = commentsPage.data.nextPageToken;
    const comments = [];
    commentsPage.data.items.forEach((comment) => {
        comments.push(comment.snippet.topLevelComment.snippet.textDisplay);
    });
    while (nextPageToken) {
        if(commentsLimit && comments.length > commentsLimit){
            break;
        }
        // console.log(nextPageToken);
        commentsPage = await http.get(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${videoID}&key=${apiKey}&pageToken=${nextPageToken}&maxResults=100`)
        commentsPage.data.items.forEach((comment) => {
            comments.push(comment.snippet.topLevelComment.snippet.textDisplay);
        });
        nextPageToken = commentsPage.data.nextPageToken;
    }

    if(commentsLimit){
        return comments.slice(0, commentsLimit);
    }
    return comments;
}


channelIDs.forEach(channel => {
        http.get(`https://www.googleapis.com/youtube/v3/channels?id=${channel}&key=${apiKey}&part=contentDetails`)
            .then(uploadsCollection => {
                getVideoIDsForChannel(uploadsCollection)
                    .then((videosIDs) => {
                        videosIDs.forEach((videoID) => {
                            getComments(videoID)
                                .then((comments) => {
                                    console.log('videoID: ' + videoID);
                                    console.log(comments.join('\n'));
                                })
                        });
                    })
            })
            .catch(err => console.error(err))
    }
);

