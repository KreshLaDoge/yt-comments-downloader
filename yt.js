// Implement custom logic for restricting QPS - default is 100 queries per 100 second and max 10 queries per second

const axios = require('axios');
const fs = require('fs');
const rateLimit = require('axios-rate-limit');

const apiKey = 'AIzaSyBEdACltbBjeVZqHlZYBfLFPkJ5fN3M5cE';
const channelIDs = ['UCQMhS3iDy2WD7JwXu6XniYA', 'UCwtr9zIfCyVS162bEF_s-TA', 'UC2BtzFqtduXt0txT6X_QAhA', 'UCqlZKBopA7F3aRshRs2tKlQ'];
const commentPagesCount = 10000;

const http = rateLimit(axios.create(), {maxRequests: 1, perMilliseconds: 11000});
let file = fs.createWriteStream('comments.txt');

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
                                                completed(videosIDs, uploadCollectionID);
                                                console.log('[+] Retrieved IDs of: ' + videosIDs.length + ' videos');
                                            }
                                        }).catch(() => console.log('[!!!] Error while fetching videos'));
                                }
                            } else {
                                completed(videosIDs, uploadCollectionID);
                                console.log('[+] Retrieved IDs of: ' + videosIDs.length + ' videos');
                            }
                        })
                }
            })
            .catch(err => console.error(err))
    }
);

function completed(videosIDs, collectionId) {
    videosIDs.forEach((video, index) => {
        console.log(`[+] Video ${index} of ${videosIDs.length} (${collectionId})`);
        http.get(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${video}&key=${apiKey}`)
            .then(commentsData => {
                let currentPageToken = null;
                if (commentsData.data.nextPageToken) {
                    currentPageToken = commentsData.data.nextPageToken;
                }
                commentsData.data.items.forEach((comment, index1) => {
                    file.write(comment.snippet.topLevelComment.snippet.textDisplay + '\n');
                });
                if (currentPageToken) {
                    for (let i = 1; i <= commentPagesCount; i++) {
                        if (currentPageToken) {
                            http.get(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${video}&key=${apiKey}&pageToken=${currentPageToken}`)
                                .then(commentsPagedData => {
                                    commentsPagedData.data.items.forEach(comment => {
                                        file.write(comment.snippet.topLevelComment.snippet.textDisplay + '\n');
                                    });
                                    if (commentsPagedData.data.nextPageToken) {
                                        currentPageToken = commentsPagedData.data.nextPageToken;
                                    } else {
                                        currentPageToken = null;
                                    }
                                })
                                .catch(err => {
                                    console.log('[!] Error while fetching comment page')
                                })
                        }
                    }
                }
            }).catch(err => console.log('[!!!] Error while fetching comments'));
    })
}
