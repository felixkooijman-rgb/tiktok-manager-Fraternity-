'use strict';
// TikTok Display API: own videos/photo posts with public counts + follower count.
// Note: "favorites/saves" are not exposed by this API – they can be entered by hand in the dashboard.
const { api } = require('../../auth/tiktok-oauth');
const FIELDS = 'id,title,video_description,create_time,cover_image_url,share_url,duration,view_count,like_count,comment_count,share_count';

module.exports = function tiktokDisplay({ config }) {
  return {
    name: 'tiktok-display',
    async user() {
      return (await api(config, 'GET', '/v2/user/info/?fields=open_id,display_name,username,avatar_url,bio_description,follower_count,following_count,likes_count,video_count')).user;
    },
    async listVideos(max = 200) {
      const out = []; let cursor; let more = true;
      while (more && out.length < max) {
        const d = await api(config, 'POST', `/v2/video/list/?fields=${FIELDS}`, { max_count: 20, ...(cursor ? { cursor } : {}) });
        out.push(...(d.videos || [])); cursor = d.cursor; more = d.has_more;
      }
      return out;
    },
    async queryVideos(ids) {
      const out = [];
      for (let i = 0; i < ids.length; i += 20) {
        const d = await api(config, 'POST', `/v2/video/query/?fields=${FIELDS}`, { filters: { video_ids: ids.slice(i, i + 20) } });
        out.push(...(d.videos || []));
      }
      return out;
    },
  };
};
