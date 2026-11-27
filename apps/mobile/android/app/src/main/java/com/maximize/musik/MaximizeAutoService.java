package com.maximize.musik;

import android.content.Intent;
import android.media.MediaDescription;
import android.media.browse.MediaBrowser;
import android.media.session.MediaSession;
import android.os.Bundle;
import android.service.media.MediaBrowserService;

import java.util.ArrayList;
import java.util.List;

/**
 * Android Auto: показывает Maximize Musik в списке медиаприложений.
 * Полноценное нативное воспроизведение появится отдельным релизом;
 * пока выбор пункта открывает приложение с плеером.
 */
public class MaximizeAutoService extends MediaBrowserService {

    private MediaSession session;

    @Override
    public void onCreate() {
        super.onCreate();
        session = new MediaSession(this, "MaximizeMusik");
        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                openApp();
            }

            @Override
            public void onPlayFromMediaId(String mediaId, Bundle extras) {
                openApp();
            }
        });
        session.setActive(true);
        setSessionToken(session.getSessionToken());
    }

    private void openApp() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
    }

    @Override
    public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle rootHints) {
        return new BrowserRoot("root", null);
    }

    @Override
    public void onLoadChildren(String parentId, Result<List<MediaBrowser.MediaItem>> result) {
        List<MediaBrowser.MediaItem> items = new ArrayList<>();
        if ("root".equals(parentId)) {
            MediaDescription description = new MediaDescription.Builder()
                    .setMediaId("open")
                    .setTitle("Открыть Maximize Musik")
                    .setSubtitle("Каталог и плеер")
                    .build();
            items.add(new MediaBrowser.MediaItem(description, MediaBrowser.MediaItem.FLAG_PLAYABLE));
        }
        result.sendResult(items);
    }

    @Override
    public void onDestroy() {
        if (session != null) {
            session.release();
            session = null;
        }
        super.onDestroy();
    }
}
