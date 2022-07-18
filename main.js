// get all video links of a yt channel
// yt-dlp -j --flat-playlist "CHANNEL_LINK" | jq -r '.id' | sed 's_^_https://youtu.be/_' > links.txt

import { main } from "./helper.js";

await main();
