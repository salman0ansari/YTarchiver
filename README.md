# YTarchiver
Archive Entire YouTube Channels to Telegram.

# FAQ

## How to get links?

Download yt-dlp
-     python3 -m pip install -U yt-dlp
Get all videos link using yt-dlp
-     yt-dlp -j --flat-playlist "CHANNEL_LINK" | jq -r '.id' | sed 's_^_https://youtu.be/_' > links.txt




## Environment Variables

To run this project, you will need to add the following environment variables to your .env file

### `COOKIES`
To get your YouTube cookie  
- navigate to YouTube in a web browser
- open up dev tools (opt+cmd+j on mac)
- go to the network tab
- click on a request on the left
- scroll down to "Request Headers"
- find the "cookie" header and copy its entire contents

### `CHANNEL_ID`
Telegram channel id Eg:
-     -10012345677n

### `APP_ID and API_HASH`
visit this link and follow given steps  
https://core.telegram.org/api/obtaining_api_id

### `SESSION_STRING`
you can generate SESSION_STRING using   
`gramjs` https://github.com/gram-js/gramjs    
 