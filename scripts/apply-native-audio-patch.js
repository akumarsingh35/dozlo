#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function patchFile(filePath, transform) {
  if (!fs.existsSync(filePath)) {
    console.log(`[native-audio-patch] Skipping missing file: ${filePath}`);
    return false;
  }

  const before = fs.readFileSync(filePath, 'utf8');
  const after = transform(before);

  if (after === before) {
    console.log(`[native-audio-patch] Already patched: ${path.basename(filePath)}`);
    return false;
  }

  fs.writeFileSync(filePath, after, 'utf8');
  console.log(`[native-audio-patch] Patched: ${path.basename(filePath)}`);
  return true;
}

function patchAudioPlayerService(source) {
  let output = source;

  if (!output.includes('import androidx.media3.extractor.DefaultExtractorsFactory;')) {
    output = output.replace(
      'import androidx.media3.common.util.UnstableApi;\nimport androidx.media3.exoplayer.ExoPlayer;',
      'import androidx.media3.common.util.UnstableApi;\nimport androidx.media3.extractor.DefaultExtractorsFactory;\nimport androidx.media3.exoplayer.ExoPlayer;\nimport androidx.media3.exoplayer.source.DefaultMediaSourceFactory;'
    );
  }

  if (!output.includes('setConstantBitrateSeekingEnabled(true)')) {
    output = output.replace(
      '        ExoPlayer player = new ExoPlayer.Builder(this)\n',
      '        // Enable constant bitrate seeking for formats like long AAC/MP3 streams\n' +
        '        // where native extractor may otherwise mark the stream as unseekable.\n' +
        '        DefaultExtractorsFactory extractorsFactory = new DefaultExtractorsFactory()\n' +
        '            .setConstantBitrateSeekingEnabled(true);\n' +
        '        DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(this, extractorsFactory);\n\n' +
        '        ExoPlayer player = new ExoPlayer.Builder(this)\n' +
        '            .setMediaSourceFactory(mediaSourceFactory)\n'
    );
  }

  return output;
}

function patchMediaSessionCallback(source) {
  let output = source;

  if (!output.includes('import androidx.media3.common.Player;')) {
    output = output.replace(
      'import androidx.annotation.OptIn;\nimport androidx.media3.common.util.UnstableApi;',
      'import androidx.annotation.OptIn;\nimport androidx.media3.common.Player;\nimport androidx.media3.common.util.UnstableApi;'
    );
  }

  if (!output.includes('setAvailablePlayerCommands(playerCommands)')) {
    output = output.replace(
      '        SessionCommands sessionCommands =\n' +
        '            MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()\n' +
        '                .add(new SessionCommand(SET_AUDIO_SOURCES, new Bundle()))\n' +
        '                .add(new SessionCommand(CREATE_PLAYER, new Bundle()))\n' +
        '                .build();\n\n' +
        '        return new MediaSession.ConnectionResult.AcceptedResultBuilder(session)\n' +
        '            .setAvailableSessionCommands(sessionCommands)\n' +
        '            .build();\n',
      '        SessionCommands sessionCommands =\n' +
        '            MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()\n' +
        '                .add(new SessionCommand(SET_AUDIO_SOURCES, new Bundle()))\n' +
        '                .add(new SessionCommand(CREATE_PLAYER, new Bundle()))\n' +
        '                .build();\n' +
        '        Player.Commands playerCommands = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS\n' +
        '            .buildUpon()\n' +
        '            .addAllCommands()\n' +
        '            .build();\n\n' +
        '        return new MediaSession.ConnectionResult.AcceptedResultBuilder(session)\n' +
        '            .setAvailableSessionCommands(sessionCommands)\n' +
        '            .setAvailablePlayerCommands(playerCommands)\n' +
        '            .build();\n'
    );
  }

  return output;
}

function main() {
  const root = process.cwd();
  const pluginBase = path.join(
    root,
    'node_modules',
    '@mediagrid',
    'capacitor-native-audio',
    'android',
    'src',
    'main',
    'java',
    'us',
    'mediagrid',
    'capacitorjs',
    'plugins',
    'nativeaudio'
  );

  const serviceFile = path.join(pluginBase, 'AudioPlayerService.java');
  const callbackFile = path.join(pluginBase, 'MediaSessionCallback.java');

  const changedA = patchFile(serviceFile, patchAudioPlayerService);
  const changedB = patchFile(callbackFile, patchMediaSessionCallback);

  if (!changedA && !changedB) {
    console.log('[native-audio-patch] No changes needed');
  }
}

main();
