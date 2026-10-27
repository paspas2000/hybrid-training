'use strict';
(() => {
  let connection;
  // IndexedDB is origin-wide; isolate repositories hosted on the same github.io origin.
  const path = new URL('./', document.baseURI).pathname;
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('hybrid-training:' + path, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('history', { keyPath: 'id' });
        db.createObjectStore('settings');
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Закрой другие вкладки дневника и открой его снова.'));
      request.onsuccess = () => {
        connection = request.result;
        connection.onversionchange = () => connection.close();
        resolve();
      };
    });
  }
  function transaction(stores, mode, callback) {
    return new Promise((resolve, reject) => {
      try {
        const tx = connection.transaction(stores, mode);
        let result;
        tx.oncomplete = () => resolve(typeof result === 'function' ? result() : result);
        tx.onabort = tx.onerror = () => reject(tx.error || new Error('Не удалось сохранить данные.'));
        result = callback(tx);
      } catch (error) { reject(error); }
    });
  }
  Hybrid.db = {
    open,
    read: () => transaction(['history', 'settings'], 'readonly', tx => {
      const history = tx.objectStore('history').getAll();
      const draft = tx.objectStore('settings').get('draft');
      const backup = tx.objectStore('settings').get('backup');
      const catalog = tx.objectStore('settings').get('catalog');
      const templates = tx.objectStore('settings').get('templates');
      const legacySnapshot = tx.objectStore('settings').get('legacySnapshot');
      return () => ({ history: history.result, draft: draft.result, backup: backup.result, catalog: catalog.result, templates: templates.result, legacySnapshot: legacySnapshot.result });
    }),
    draft: value => transaction(['settings'], 'readwrite', tx => tx.objectStore('settings').put(value, 'draft')),
    finish: workout => transaction(['history', 'settings'], 'readwrite', tx => {
      tx.objectStore('history').add(workout);
      tx.objectStore('settings').delete('draft');
    }),
    deleteWorkout: id => transaction(['history'], 'readwrite', tx => tx.objectStore('history').delete(id)),
    import: (history, draft, catalog, templates) => transaction(['history', 'settings'], 'readwrite', tx => {
      history.forEach(workout => tx.objectStore('history').add(workout));
      if (draft) tx.objectStore('settings').put(draft, 'draft');
      if (catalog) tx.objectStore('settings').put(catalog, 'catalog');
      if (templates) tx.objectStore('settings').put(templates, 'templates');
    }),
    backup: value => transaction(['settings'], 'readwrite', tx => tx.objectStore('settings').put(value, 'backup')),
    catalog: value => transaction(['settings'], 'readwrite', tx => tx.objectStore('settings').put(value, 'catalog')),
    templates: value => transaction(['settings'], 'readwrite', tx => tx.objectStore('settings').put(value, 'templates')),
    migrate: (history, draft, snapshot) => transaction(['history', 'settings'], 'readwrite', tx => {
      const workouts = tx.objectStore('history'), settings = tx.objectStore('settings');
      history.forEach(workout => workouts.put(workout));
      if (draft) settings.put(draft, 'draft');
      settings.put(snapshot, 'legacySnapshot');
    })
  };
})();
