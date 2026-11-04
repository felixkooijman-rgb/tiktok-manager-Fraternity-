'use strict';
// Official TikTok Content Posting API – photo (carousel) posts.
// Docs: https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
//  * PHOTO posts only support source=PULL_FROM_URL from a verified domain/URL prefix.
//  * Until the app passes TikTok's audit, direct posts are limited to SELF_ONLY (private) visibility.
//  * creator_info must be queried before each post; privacy must be one of its options.
const { api } = require('../../auth/tiktok-oauth');

module.exports = function tiktokPublisher({ config }) {
  const ready = !!(config.env.TIKTOK_CLIENT_KEY && config.env.TIKTOK_CLIENT_SECRET);
  return {
    name: 'tiktok',
    ready,
    creatorInfo: () => api(config, 'POST', '/v2/post/publish/creator_info/query/'),
    async publish(post, { imageUrls }) {
      const info = await api(config, 'POST', '/v2/post/publish/creator_info/query/');
      const privacy = post.publishSettings?.privacyLevel;
      if (!privacy) throw new Error('privacy level not chosen for this post (choose it in the dashboard)');
      if (!info.privacy_level_options.includes(privacy)) throw new Error(`privacy ${privacy} not allowed for this account now; options: ${info.privacy_level_options.join(', ')}`);
      if (info.comment_disabled && post.publishSettings?.allowComments) post.publishSettings.allowComments = false;
      const mode = config.publishing.postMode === 'MEDIA_UPLOAD' ? 'MEDIA_UPLOAD' : 'DIRECT_POST';
      const body = {
        media_type: 'PHOTO',
        post_mode: mode,
        post_info: {
          title: post.title.slice(0, 90),
          description: `${post.caption}\n\n${post.hashtags.join(' ')}`.slice(0, 4000),
          privacy_level: privacy,
          disable_comment: !post.publishSettings.allowComments,
          auto_add_music: !!config.publishing.autoAddMusic,
          brand_content_toggle: !!post.publishSettings.brandedContent,
          brand_organic_toggle: !!post.publishSettings.brandOrganic,
        },
        source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: imageUrls },
      };
      const data = await api(config, 'POST', '/v2/post/publish/content/init/', body);
      return { publishId: data.publish_id, mode, creator: info.creator_username };
    },
    async status(publishId) {
      const d = await api(config, 'POST', '/v2/post/publish/status/fetch/', { publish_id: publishId });
      return { status: d.status, failReason: d.fail_reason, postIds: d.publicaly_available_post_id || [] };
    },
  };
};
