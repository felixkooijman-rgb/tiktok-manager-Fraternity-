'use strict';
// Upload a post folder with any CLI (rclone, aws s3 cp, gsutil, scp…) to a host on your
// TikTok-verified domain; files are then reachable at PUBLIC_MEDIA_BASE_URL/<postId>/<file>.
const { execSync } = require('child_process');
module.exports = function commandHost({ config }) {
  const cmd = config.env.MEDIA_SYNC_COMMAND, base = config.env.PUBLIC_MEDIA_BASE_URL;
  if (!cmd || !base) return null;
  return {
    name: 'command',
    async upload(post, dir) {
      execSync(cmd.replace(/\{dir\}/g, JSON.stringify(dir)).replace(/\{postId\}/g, post.id), { stdio: 'inherit' });
      return post.slides.map((s) => `${base.replace(/\/$/, '')}/${post.id}/${s.file}`);
    },
  };
};
