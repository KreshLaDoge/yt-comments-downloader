// Implement custom logic for restricting QPS - default is 100 queries per 100 second and max 10 queries per second

const axios = require('axios');
const fs = require('fs');
const rateLimit = require('axios-rate-limit');

const apiKey = 'AIzaSyBEdACltbBjeVZqHlZYBfLFPkJ5fN3M5cE';
const channelIDs = ['UC0gOw4iy-6HwO01q-gA1B0Q'];
const commentPagesCount = 2;
let comments = [];

const http = rateLimit(axios.create(), {maxRequests: 1, perMilliseconds: 1150});

channelIDs.forEach(channel => {
        let uploadCollectionID;
        http.get(`https://www.googleapis.com/youtube/v3/channels?id=${channel}&key=${apiKey}&part=contentDetails`)
            .then(uploadsCollection => {
                uploadCollectionID = uploadsCollection.data.items[0].contentDetails.relatedPlaylists.uploads;
                if (uploadCollectionID) {
                    console.log('[+] Retrieved upload collection id: ' + uploadCollectionID);
                    http.get(`https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${uploadCollectionID}&key=${apiKey}&part=snippet&maxResults=50`)
                        .then(firstVideos => {
                            let currentNextPageToken = firstVideos.data.nextPageToken;
                            const totalVideos = firstVideos.data.pageInfo.totalResults;
                            const numberOfPages = Math.ceil(totalVideos / 50);
                            let videosIDs = [];

                            firstVideos.data.items.forEach(video => {
                                videosIDs.push(video.snippet.resourceId.videoId);
                            });

                            if (numberOfPages > 1) {
                                for (let i = 1; i <= numberOfPages; i++) {
                                    http.get(`https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${uploadCollectionID}&key=${apiKey}&part=snippet&maxResults=50&pageToken=${currentNextPageToken}`)
                                        .then(videos => {
                                            videos.data.items.forEach(video => {
                                                videosIDs.push(video.snippet.resourceId.videoId);
                                            });
                                            if (videos.data.nextPageToken) {
                                                currentNextPageToken = videos.data.nextPageToken;
                                            }
                                            if (i === numberOfPages) {
                                                completed(videosIDs);
                                                console.log('[+] Retrieved IDs of: ' + videosIDs.length + ' videos');
                                            }
                                        }).catch(() => console.log('Early error'));
                                }
                            } else {
                                completed(videosIDs);
                                console.log('[+] Retrieved IDs of: ' + videosIDs.length + ' videos');
                            }
                        })
                }
            })
            .catch(err => console.error(err))
    }
);

function completed(videosIDs) {
    videosIDs.forEach((video, index) => {
        http.get(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${video}&key=${apiKey}`)
            .then(commentsData => {
                console.log('[+] Fetching comments for the video: ' + (+index + +1 ));
                let currentPageToken = null;
                if (commentsData.data.nextPageToken) {
                    currentPageToken = commentsData.data.nextPageToken;
                }
                commentsData.data.items.forEach((comment, index1) => {
                    comments.push(comment.snippet.topLevelComment.snippet.textDisplay);
                    if (index + 1 === videosIDs.length && index1 === commentsData.data.items.length) {
                        console.log('[Success] Saving comments');
                        fileSave(comments)
                    }
                });
                if (currentPageToken) {
                    for (let i = 1; i <= commentPagesCount; i++) {
                        http.get(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${video}&key=${apiKey}&pageToken=${currentPageToken}`)
                            .then(commentsPagedData => {
                                commentsPagedData.data.items.forEach(comment => {
                                    comments.push(comment.snippet.topLevelComment.snippet.textDisplay);
                                });
                                if (commentsPagedData.data.nextPageToken) {
                                    currentPageToken = commentsPagedData.data.nextPageToken;
                                } else {
                                    currentPageToken = null;
                                }
                            })
                            .catch(err => {console.log('[!] Error while fetching comment page')})
                    }
                }
            }).catch(err => console.log('Far error'));
    })
}

function fileSave(data) {
    let file = fs.createWriteStream('comments.txt');
    file.on('error', err => {
        console.log('[!] Script was not able to save file.')
    });
    data.forEach(v => {
        file.write(v + '\n');
    });
    file.end();
    console.log(`[+++] ${data.length} comments was saved into file`)
}
