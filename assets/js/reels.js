/* ==========================================================================
   LaRosita-ECO — Reels JS (Vanilla JavaScript & Offline DB Storage)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Determine paths based on page level (root vs pages/ subdirectory)
  const isSubpage = window.location.pathname.includes('/pages/');
  const basePath = isSubpage ? '../' : '';

  // 1. DYNAMICALLY INJECT CSS STYLE SHEET
  if (!document.querySelector('link[href*="reels.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${basePath}assets/css/reels.css`;
    document.head.appendChild(link);
  }

  // Supabase Configuration (Set credentials to sync globally)
  const SUPABASE_URL = 'https://taklcpjdemzyyiiiiuqs.supabase.co'; // Escribe aquí la URL de tu proyecto de Supabase
  const SUPABASE_ANON_KEY = 'sb_publishable_l8Ks_okKyNvc0OhcQPB1kg_MHFGxXFt'; // Escribe aquí la clave Anon de Supabase
  let supabase = null;
  let useSupabase = false;
  let supabaseError = null;
  let isCheckingSupabase = false;

  async function initSupabase() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof window.supabase !== 'undefined') {
      try {
        isCheckingSupabase = true;
        updateConnectionStatusUI();
        
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Realizar una consulta de prueba rápida para validar la conexión y verificar si está activo
        const { data, error } = await supabase
          .from('reels')
          .select('id')
          .limit(1);

        if (error) {
          throw error;
        }

        useSupabase = true;
        supabaseError = null;
        console.log('LaRositaReels: Supabase cloud sync active and verified.');
      } catch (err) {
        console.error('Failed to connect to Supabase:', err);
        useSupabase = false;
        // Capturar error detallado (por ejemplo, error de red)
        supabaseError = err.message || String(err);
      } finally {
        isCheckingSupabase = false;
        updateConnectionStatusUI();
      }
    } else {
      useSupabase = false;
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        supabaseError = 'Credenciales de Supabase no configuradas';
      } else {
        supabaseError = 'Biblioteca client de Supabase no cargada';
      }
      updateConnectionStatusUI();
    }
  }

  const updateConnectionStatusUI = () => {
    const statusBar = document.getElementById('reelsStatusBar');
    const warningMsg = document.getElementById('reelsLocalWarning');
    if (!statusBar) return;

    if (isCheckingSupabase) {
      statusBar.className = 'reels-status-bar status-checking';
      statusBar.innerHTML = `
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <span>Verificando conexión con la nube...</span>
      `;
      if (warningMsg) warningMsg.style.display = 'none';
    } else if (useSupabase && supabase) {
      statusBar.className = 'reels-status-bar status-connected';
      statusBar.innerHTML = `
        <i class="fa-solid fa-circle-check"></i>
        <span>Sincronización activa (Nube)</span>
      `;
      if (warningMsg) warningMsg.style.display = 'none';
    } else {
      statusBar.className = 'reels-status-bar status-disconnected';
      let errorDetail = 'Modo Local Activo';
      if (supabaseError) {
        if (supabaseError.includes('Failed to fetch') || supabaseError.includes('NetworkError') || supabaseError.includes('TypeError')) {
          errorDetail += ' (El proyecto de Supabase podría estar pausado)';
        } else {
          errorDetail += ` (${supabaseError})`;
        }
      }
      statusBar.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${errorDetail}</span>
      `;
      if (warningMsg) warningMsg.style.display = 'block';
    }
  };

  // 2. STATE MANAGEMENT
  const ADMIN_PASSWORD = 'RositaEco2026';

  const verifyAdminPassword = () => {
    const input = prompt('Introduce la clave de administrador para confirmar esta acción:');
    if (input === null) return false;
    if (input === ADMIN_PASSWORD) {
      return true;
    } else {
      showToast('Clave incorrecta. Acción cancelada.', 'error');
      return false;
    }
  };

  let isAdminMode = sessionStorage.getItem('reelsAdminMode') === 'true';
  let db = null;
  let reelsList = [];
  let globalMuted = true; // Default to true due to autoplay policies
  let activeSlideIndex = 0;
  let activeVideo = null;
  let isDraggingProgress = false;

  // Preloaded sample vertical reels (Nature & Kid Activities)
  const preloadedReels = [
    {
      id: 'preload-1',
      url: 'https://assets.mixkit.co/videos/preview/mixkit-tree-branches-and-leaves-bending-in-the-wind-41235-large.mp4',
      title: 'Conexión Natural 🌿',
      desc: 'En LaRosita-ECO conectamos a los niños con la naturaleza a través del juego libre.',
      likes: 124,
      isPreloaded: true
    },
    {
      id: 'preload-2',
      url: 'https://assets.mixkit.co/videos/preview/mixkit-father-and-his-little-daughter-walking-in-nature-39744-large.mp4',
      title: 'Exploración Ecológica 🥾',
      desc: 'Aventuras guiadas y senderismo para fortalecer valores ambientales y familiares.',
      likes: 89,
      isPreloaded: true
    },
    {
      id: 'preload-3',
      url: 'https://assets.mixkit.co/videos/preview/mixkit-little-girl-playing-with-autumn-leaves-in-a-park-39737-large.mp4',
      title: 'Juego y Recreación 🍂',
      desc: 'La felicidad de jugar al aire libre y sentir el entorno con libertad y seguridad.',
      likes: 156,
      isPreloaded: true
    },
    {
      id: 'preload-4',
      url: 'https://assets.mixkit.co/videos/preview/mixkit-green-leaves-on-a-branch-in-close-up-41584-large.mp4',
      title: 'Talleres de Huerto y Compost 🌱',
      desc: 'Aprendiendo sobre biodiversidad observando de cerca el ciclo de la vida vegetal.',
      likes: 95,
      isPreloaded: true
    }
  ];

  // 3. INDEXEDDB & CLOUD DB SETUP (Unified database wrapper)
  const initDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LaRositaReelsDB', 1);

      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains('reels')) {
          database.createObjectStore('reels', { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        db = e.target.result;
        if (typeof window.supabase !== 'undefined') {
          initSupabase();
        }
        resolve(db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB error:', e.target.error);
        reject(e.target.error);
      };
    });
  };

  const getCustomReels = async () => {
    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from('reels')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data.map(item => ({
          id: item.id,
          url: item.url,
          title: item.title,
          desc: item.desc,
          likes: item.likes_count || 0,
          isPreloaded: false
        }));
      } catch (err) {
        console.error('Supabase fetch failed, fallback to local DB:', err);
      }
    }

    return new Promise((resolve) => {
      if (!db) return resolve([]);
      const transaction = db.transaction(['reels'], 'readonly');
      const store = transaction.objectStore('reels');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  };

  const saveCustomReel = async (reel) => {
    if (useSupabase && supabase) {
      try {
        const file = reel.videoBlob;
        const fileName = `${reel.id}.mp4`;

        // 1. Upload video file to Supabase Storage Bucket 'reels'
        const { error: uploadError } = await supabase.storage
          .from('reels')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: urlData } = supabase.storage
          .from('reels')
          .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl;

        // 3. Save metadata row
        const { error: insertError } = await supabase
          .from('reels')
          .insert([
            {
              id: reel.id,
              title: reel.title,
              desc: reel.desc,
              url: publicUrl,
              likes_count: 0
            }
          ]);

        if (insertError) throw insertError;
        return;
      } catch (err) {
        console.error('Supabase save error:', err);
        throw err;
      }
    }

    return new Promise((resolve, reject) => {
      if (!db) return reject('Database not initialized');
      const transaction = db.transaction(['reels'], 'readwrite');
      const store = transaction.objectStore('reels');
      const request = store.put(reel);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  const deleteCustomReel = async (id) => {
    if (useSupabase && supabase) {
      try {
        const { error: dbError } = await supabase
          .from('reels')
          .delete()
          .eq('id', id);
        if (dbError) throw dbError;

        const fileName = `${id}.mp4`;
        const { error: storageError } = await supabase.storage
          .from('reels')
          .remove([fileName]);
        if (storageError) console.error('Error removing file from Supabase storage:', storageError);
        return;
      } catch (err) {
        console.error('Supabase delete error:', err);
        throw err;
      }
    }

    return new Promise((resolve, reject) => {
      if (!db) return reject('Database not initialized');
      const transaction = db.transaction(['reels'], 'readwrite');
      const store = transaction.objectStore('reels');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  // 4. TOAST NOTIFICATION SYSTEM
  const createToastContainer = () => {
    const container = document.createElement('div');
    container.className = 'reels-toast-container';
    document.body.appendChild(container);
    return container;
  };

  const toastContainer = createToastContainer();

  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `reels-toast reels-toast-${type}`;

    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${iconClass}"></i>
      <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 50);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  // 5. GENERATE DOM STRUCTURE
  const buildUI = () => {
    // Add floating button
    const floatBtn = document.createElement('button');
    floatBtn.id = 'reelsFloatBtn';
    floatBtn.className = 'reels-float-btn';
    floatBtn.setAttribute('aria-label', 'Ver Reels de LaRosita-ECO');
    floatBtn.innerHTML = '<i class="fa-solid fa-clapperboard"></i>';
    document.body.appendChild(floatBtn);

    // Add float button hover label
    const floatLabel = document.createElement('div');
    floatLabel.className = 'reels-float-label';
    floatLabel.innerHTML = '<span>Ver Reels 🎬</span>';
    document.body.appendChild(floatLabel);

    // Auto-show label after 3 seconds to catch attention, then auto-hide
    setTimeout(() => {
      floatLabel.classList.add('auto-show');
      setTimeout(() => {
        floatLabel.classList.remove('auto-show');
      }, 4000);
    }, 3000);

    // Add main reels modal overlay
    const modal = document.createElement('div');
    modal.id = 'reelsModal';
    modal.className = 'reels-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="reels-modal-inner">
        <!-- Main header (indicators/controls) -->
        <div class="reels-header">
          <button class="reel-btn-admin" id="reelsAdminBtn" title="Administrar Reels" style="display: none;">
            <i class="fa-solid fa-sliders"></i>
          </button>
          <div class="reels-indicator" id="reelsIndicator">1 / 1</div>
          <button class="reel-btn-close" id="reelsCloseBtn" title="Cerrar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Vertical Snap-scroll Viewport -->
        <div class="reels-viewport" id="reelsViewport"></div>

        <!-- Administration Slide-over Panel -->
        <div class="reels-admin-panel" id="reelsAdminPanel">
          <div class="reels-admin-header">
            <h2><i class="fa-solid fa-photo-film"></i> Administrar</h2>
            <button class="reels-admin-close" id="reelsAdminCloseBtn"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <!-- Barra de Estado de Conexión -->
          <div class="reels-status-bar" id="reelsStatusBar">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            <span>Verificando conexión con la nube...</span>
          </div>
          
          <form class="reels-form" id="reelsUploadForm" novalidate>
            <div class="reels-form-group">
              <label>Video del Reel (Formato MP4)</label>
              <div class="reels-file-drop" id="reelsDropZone">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <p>Arrastra tu video aquí o haz clic</p>
                <span>Máximo 60 MB</span>
                <input type="file" id="reelsFileInput" accept="video/mp4" style="display: none;" />
              </div>
            </div>

            <div class="reels-form-group">
              <label for="reelTitleInput">Título</label>
              <input type="text" id="reelTitleInput" class="reels-input" placeholder="Ej: Talleres creativos 🎨" required maxlength="50" />
            </div>

            <div class="reels-form-group">
              <label for="reelDescInput">Descripción</label>
              <textarea id="reelDescInput" class="reels-textarea" placeholder="Describe brevemente el momento ecológico..." required maxlength="120"></textarea>
            </div>

            <!-- Advertencia Modo Local -->
            <div class="reels-local-warning" id="reelsLocalWarning" style="display: none; background: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.25); padding: 10px; border-radius: 8px; font-size: 12px; color: #ffb74d; margin-bottom: 5px; text-align: left; line-height: 1.4;">
              <i class="fa-solid fa-triangle-exclamation" style="margin-right: 5px; color: #ffa726;"></i>
              <strong>Modo Local Activo:</strong> El video solo se guardará en este navegador. Activa tu proyecto en Supabase para que sea visible para todos.
            </div>

            <!-- Loader / Progress -->
            <div class="reels-upload-progress" id="reelsUploadProgress">
              <div class="reels-upload-status">
                <span id="reelsProgressPercentage">Guardando...</span>
                <span>Por favor espera</span>
              </div>
              <div class="reels-progress-bar-outer">
                <div class="reels-progress-bar-inner" id="reelsProgressBarInner"></div>
              </div>
            </div>

            <button type="submit" class="reels-submit-btn" id="reelsSubmitBtn">
              <i class="fa-solid fa-upload"></i> Subir Reel
            </button>
          </form>

          <div class="reels-admin-list-container">
            <h3>Mis Reels Subidos</h3>
            <div class="reels-admin-list" id="reelsAdminList">
              <!-- Dynamically populated admin list items -->
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  buildUI();

  // Get DOM elements references
  const floatBtn = document.getElementById('reelsFloatBtn');
  const modal = document.getElementById('reelsModal');
  const viewport = document.getElementById('reelsViewport');
  const closeBtn = document.getElementById('reelsCloseBtn');
  const indicator = document.getElementById('reelsIndicator');

  // Admin panel elements
  const adminBtn = document.getElementById('reelsAdminBtn');
  const adminPanel = document.getElementById('reelsAdminPanel');
  const adminCloseBtn = document.getElementById('reelsAdminCloseBtn');
  const uploadForm = document.getElementById('reelsUploadForm');
  const dropZone = document.getElementById('reelsDropZone');
  const fileInput = document.getElementById('reelsFileInput');
  const titleInput = document.getElementById('reelTitleInput');
  const descInput = document.getElementById('reelDescInput');
  const submitBtn = document.getElementById('reelsSubmitBtn');
  const uploadProgress = document.getElementById('reelsUploadProgress');
  const progressBarInner = document.getElementById('reelsProgressBarInner');
  const progressPercentage = document.getElementById('reelsProgressPercentage');
  const adminList = document.getElementById('reelsAdminList');

  // 6. RENDER REEL SLIDES
  async function renderReels() {
    // Clear viewport
    viewport.innerHTML = '';

    // Fetch custom reels from db
    const customReels = await getCustomReels();

    // Prepare urls (revoke previous objectUrls to prevent memory leaks)
    reelsList.forEach(reel => {
      if (reel.objectUrl) URL.revokeObjectURL(reel.objectUrl);
    });

    // Process custom reels and generate Object URLs
    const customReelsProcessed = customReels.map(reel => {
      let videoUrl = reel.url;
      let objectUrl = null;
      if (reel.videoBlob) {
        objectUrl = URL.createObjectURL(reel.videoBlob);
        videoUrl = objectUrl;
      }
      return {
        id: reel.id,
        url: videoUrl,
        objectUrl: objectUrl, // store ref to revoke later
        title: reel.title,
        desc: reel.desc,
        likes: reel.likes !== undefined ? reel.likes : (localStorage.getItem(`reels-likes-${reel.id}`) ? parseInt(localStorage.getItem(`reels-likes-${reel.id}`)) : 0),
        isPreloaded: false
      };
    });

    // Merge preloaded and custom reels (custom reels appear first for immediate feedback)
    reelsList = [...customReelsProcessed, ...preloadedReels];

    // Build the reels slides in DOM
    if (reelsList.length === 0) {
      viewport.innerHTML = `
        <div class="reel-slide" style="flex-direction:column; justify-content:center; text-align:center; padding: 20px;">
          <i class="fa-solid fa-film" style="font-size:48px; color:#8bc24f; margin-bottom:15px;"></i>
          <h3>No hay reels cargados</h3>
          <p style="color:rgba(255,255,255,0.6); font-size:14px; margin-top:5px;">Usa el botón de administración para subir el primero.</p>
        </div>
      `;
      indicator.textContent = '0 / 0';
      return;
    }

    reelsList.forEach((reel, idx) => {
      const slide = document.createElement('div');
      slide.className = 'reel-slide';
      slide.id = `reel-slide-${reel.id}`;
      slide.dataset.index = idx;
      slide.dataset.id = reel.id;

      // Check if user has liked this reel
      const isLiked = localStorage.getItem(`reels-liked-state-${reel.id}`) === 'true';
      const likeCount = localStorage.getItem(`reels-likes-${reel.id}`) ? parseInt(localStorage.getItem(`reels-likes-${reel.id}`)) : reel.likes;

      slide.innerHTML = `
        <div class="reel-gradient-top"></div>
        
        <!-- Video Element -->
        <video loop playsinline webkit-playsinline preload="none" data-src="${reel.url}" ${globalMuted ? 'muted' : ''}>
          Tu navegador no soporta videos.
        </video>

        <!-- Loader -->
        <div class="reel-loader">
          <div class="reel-spinner"></div>
        </div>

        <!-- Bounce Feedback Overlay for play/pause -->
        <div class="reel-play-feedback">
          <div class="reel-feedback-icon">
            <i class="fa-solid fa-play"></i>
          </div>
        </div>

        <!-- Sidebar interactions -->
        <div class="reel-actions-sidebar">
          <!-- Profile Badge -->
          <div class="reel-avatar" title="LaRosita-ECO">
            <i class="fa-solid fa-leaf"></i>
          </div>

          <!-- Like action -->
          <div class="reel-action-item">
            <button class="reel-action-btn btn-like ${isLiked ? 'liked' : ''}" aria-label="Me gusta">
              <i class="fa-solid fa-heart"></i>
            </button>
            <span class="reel-action-label count-like">${likeCount}</span>
          </div>

          <!-- Volume action -->
          <div class="reel-action-item">
            <button class="reel-action-btn btn-volume ${globalMuted ? 'muted' : ''}" aria-label="Silenciar / Activar sonido">
              <i class="fa-solid ${globalMuted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>
            </button>
            <span class="reel-action-label">Sonido</span>
          </div>

          <!-- Share action -->
          <div class="reel-action-item">
            <button class="reel-action-btn btn-share" aria-label="Compartir">
              <i class="fa-solid fa-share"></i>
            </button>
            <span class="reel-action-label">Compartir</span>
          </div>

          <!-- Delete action (custom videos only) -->
          ${(!reel.isPreloaded && isAdminMode) ? `
            <div class="reel-action-item">
              <button class="reel-action-btn btn-delete" aria-label="Eliminar reel">
                <i class="fa-solid fa-trash-can"></i>
              </button>
              <span class="reel-action-label">Borrar</span>
            </div>
          ` : ''}
        </div>

        <!-- Bottom info overlay -->
        <div class="reel-info-overlay">
          <div class="reel-info-user">
            @larositaeco
            <i class="fa-solid fa-circle-check verified-badge" title="Cuenta verificada"></i>
          </div>
          <h3 class="reel-info-title">${reel.title}</h3>
          <p class="reel-info-desc">${reel.desc}</p>
        </div>

        <!-- Seek / Progress bar -->
        <div class="reel-progress-container">
          <div class="reel-progress-track">
            <div class="reel-progress-fill"></div>
            <div class="reel-progress-handle"></div>
          </div>
        </div>
      `;

      viewport.appendChild(slide);

      // Attach slide-specific events
      setupSlideEvents(slide, reel);
    });

    indicator.textContent = `1 / ${reelsList.length}`;
    updateAdminList(customReels);
    setupAutoplayObserver();
  };

  // 7. SETUP EVENT LISTENERS FOR INDIVIDUAL REEL SLIDES
  const setupSlideEvents = (slide, reel) => {
    const video = slide.querySelector('video');
    const loader = slide.querySelector('.reel-loader');
    const playFeedback = slide.querySelector('.reel-play-feedback');
    const feedbackIcon = playFeedback.querySelector('.reel-feedback-icon');
    const feedbackIconInner = feedbackIcon.querySelector('i');

    const likeBtn = slide.querySelector('.btn-like');
    const likeCountSpan = slide.querySelector('.count-like');
    const volumeBtn = slide.querySelector('.btn-volume');
    const shareBtn = slide.querySelector('.btn-share');
    const deleteBtn = slide.querySelector('.btn-delete');
    const avatar = slide.querySelector('.reel-avatar');
    const infoUser = slide.querySelector('.reel-info-user');

    const progressContainer = slide.querySelector('.reel-progress-container');
    const progressFill = slide.querySelector('.reel-progress-fill');

    // A. Loader toggling while buffering & Fade-in
    video.addEventListener('waiting', () => loader.classList.add('active'));
    video.addEventListener('playing', () => {
      loader.classList.remove('active');
      video.classList.add('loaded');
    });
    video.addEventListener('loadeddata', () => {
      loader.classList.remove('active');
      video.classList.add('loaded'); // First frame is ready
    });
    video.addEventListener('canplay', () => {
      loader.classList.remove('active');
      video.classList.add('loaded');
    });
    video.addEventListener('timeupdate', () => {
      if (video.currentTime > 0.1) {
        video.classList.add('loaded');
      }
    });

    // Fallback if video is already loaded from cache
    if (video.readyState >= 2) {
      loader.classList.remove('active');
      video.classList.add('loaded');
    }

    // B. Tap video to Play/Pause
    const togglePlay = () => {
      if (video.paused) {
        video.play().catch(err => console.log('Autoplay restriction:', err));
        feedbackIconInner.className = 'fa-solid fa-play';
      } else {
        video.pause();
        feedbackIconInner.className = 'fa-solid fa-pause';
      }

      // Flash play/pause indicator in the center
      feedbackIcon.classList.remove('show');
      void feedbackIcon.offsetWidth; // Trigger reflow to restart animation
      feedbackIcon.classList.add('show');
    };

    video.addEventListener('click', togglePlay);

    // Click profile avatar (leaf icon badge) to trigger admin login
    if (avatar) {
      avatar.addEventListener('click', (e) => {
        e.stopPropagation();

        if (isAdminMode) {
          openAdminPanel();
          return;
        }

        if (verifyAdminPassword()) {
          sessionStorage.setItem('reelsAdminMode', 'true');
          isAdminMode = true;

          const adminButton = document.getElementById('reelsAdminBtn');
          if (adminButton) adminButton.style.display = 'flex';

          showToast('Modo administrador activado');
          renderReels();

          setTimeout(() => {
            openAdminPanel();
          }, 300);
        }
      });
    }

    // C. Mute / Unmute Syncing
    const toggleMute = (e) => {
      e.stopPropagation();
      globalMuted = !globalMuted;

      // Update all video volumes in viewport
      const allVideos = viewport.querySelectorAll('video');
      allVideos.forEach(v => {
        v.muted = globalMuted;
      });

      // Update all mute buttons UI
      const allVolumeBtns = viewport.querySelectorAll('.btn-volume');
      allVolumeBtns.forEach(btn => {
        btn.classList.toggle('muted', globalMuted);
        const icon = btn.querySelector('i');
        if (icon) {
          icon.className = `fa-solid ${globalMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`;
        }
      });

      showToast(globalMuted ? 'Sonido silenciado' : 'Sonido activado', 'warning');
    };

    volumeBtn.addEventListener('click', toggleMute);

    // D. Like Functionality
    likeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      let isLiked = localStorage.getItem(`reels-liked-state-${reel.id}`) === 'true';
      let currentLikesCount = localStorage.getItem(`reels-likes-${reel.id}`) ? parseInt(localStorage.getItem(`reels-likes-${reel.id}`)) : reel.likes;

      if (isLiked) {
        isLiked = false;
        currentLikesCount--;
        likeBtn.classList.remove('liked');
      } else {
        isLiked = true;
        currentLikesCount++;
        likeBtn.classList.add('liked');
        showToast('Añadido a tus favoritos');
      }

      localStorage.setItem(`reels-liked-state-${reel.id}`, String(isLiked));
      localStorage.setItem(`reels-likes-${reel.id}`, String(currentLikesCount));
      likeCountSpan.textContent = currentLikesCount;

      // Update Supabase globally if cloud sync is active
      if (useSupabase && supabase && !reel.isPreloaded) {
        supabase
          .from('reels')
          .update({ likes_count: currentLikesCount })
          .eq('id', reel.id)
          .then(({ error }) => {
            if (error) console.error('Error syncing likes count:', error);
          });
      }
    });

    // E. Share Functionality
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      // Construct deep link URL
      // We append ?reel=ID to root or current path. Ensure it works on Netlify structure too
      const currentUrl = window.location.href.split('?')[0];
      const deepLink = `${currentUrl}?reel=${reel.id}`;

      // Clipboard fallback
      navigator.clipboard.writeText(deepLink)
        .then(() => {
          showToast('Enlace de Reel copiado al portapapeles');
        })
        .catch(() => {
          // If navigator.clipboard fails
          const textArea = document.createElement('textarea');
          textArea.value = deepLink;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            showToast('Enlace de Reel copiado al portapapeles');
          } catch (err) {
            showToast('No se pudo copiar el enlace', 'error');
          }
          document.body.removeChild(textArea);
        });
    });

    // F. Delete Functionality (custom videos only)
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!verifyAdminPassword()) return;
        if (confirm('¿Estás seguro de que quieres eliminar este reel? Esta acción no se puede deshacer.')) {
          try {
            // Delete from IndexedDB
            await deleteCustomReel(reel.id);
            // Clean localStorage values
            localStorage.removeItem(`reels-liked-state-${reel.id}`);
            localStorage.removeItem(`reels-likes-${reel.id}`);

            showToast('Reel eliminado correctamente', 'error');

            // Re-render
            await renderReels();

            // Re-run the navigation/indicator updater
            handleScroll();
          } catch (err) {
            showToast('Error al eliminar el reel', 'error');
            console.error(err);
          }
        }
      });
    }

    // G. Progress Bar seeking
    const seekVideo = (e) => {
      const rect = progressContainer.querySelector('.reel-progress-track').getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      video.currentTime = percentage * video.duration;
      progressFill.style.transform = `scaleX(${percentage})`;
    };

    progressContainer.addEventListener('mousedown', (e) => {
      isDraggingProgress = true;
      seekVideo(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (isDraggingProgress && activeVideo === video) {
        seekVideo(e);
      }
    });

    document.addEventListener('mouseup', () => {
      isDraggingProgress = false;
    });

    // Keep progress bar filling synced with video progress
    video.addEventListener('timeupdate', () => {
      if (!isDraggingProgress && video.duration) {
        const percentage = video.currentTime / video.duration;
        progressFill.style.transform = `scaleX(${percentage})`;
      }
    });
  };

  // 8. AUTOPLAY & SCROLL DETECTION VIA INTERSECTION OBSERVER
  const updateVideoSources = (activeIndex) => {
    const slides = viewport.querySelectorAll('.reel-slide');
    slides.forEach((slide, idx) => {
      const video = slide.querySelector('video');
      if (!video) return;

      const isNear = Math.abs(idx - activeIndex) <= 1; // Current, prev, next
      const isFar = Math.abs(idx - activeIndex) > 2;

      if (isNear) {
        if (!video.src) {
          video.src = video.dataset.src;
          video.load();
        }
        if (idx === activeIndex) {
          video.preload = 'auto';
        } else {
          video.preload = 'metadata'; // Preload adjacent lightly
        }
      } else if (isFar) {
        if (video.src) {
          video.pause();
          video.removeAttribute('src'); // Unload video to save memory
          video.load(); // Force memory release
          video.classList.remove('loaded');
        }
      }
    });
  };

  let reelsObserver = null;

  const setupAutoplayObserver = () => {
    if (reelsObserver) {
      reelsObserver.disconnect();
    }

    const observerOptions = {
      root: viewport,
      threshold: 0.55 // Trigger slightly earlier
    };

    let scrollTimeout;

    reelsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const slide = entry.target;
        const video = slide.querySelector('video');
        const idx = parseInt(slide.dataset.index);

        if (!video) return;

        if (entry.isIntersecting) {
          activeSlideIndex = idx;
          activeVideo = video;
          indicator.textContent = `${activeSlideIndex + 1} / ${reelsList.length}`;

          // Ensure source is loaded before playing
          if (!video.src) {
            video.src = video.dataset.src;
            video.load();
          }

          video.muted = globalMuted;
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.log("Autoplay blocked by browser:", error);
            });
          }

          // Smart memory management on scroll
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            updateVideoSources(activeSlideIndex);
          }, 150);

        } else {
          video.pause();
        }
      });
    }, observerOptions);

    // Observe all slides
    const slides = viewport.querySelectorAll('.reel-slide');
    slides.forEach(slide => reelsObserver.observe(slide));
  };

  // Fallback Scroll Detection to update indicators / state if needed
  const handleScroll = () => {
    const slides = viewport.querySelectorAll('.reel-slide');
    if (slides.length === 0) return;

    // Find which slide is closest to the top of viewport
    let closestSlide = null;
    let minDiff = Infinity;

    slides.forEach(slide => {
      const rect = slide.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const diff = Math.abs(rect.top - viewportRect.top);
      if (diff < minDiff) {
        minDiff = diff;
        closestSlide = slide;
      }
    });

    if (closestSlide) {
      const idx = parseInt(closestSlide.dataset.index);
      activeSlideIndex = idx;
      indicator.textContent = `${activeSlideIndex + 1} / ${reelsList.length}`;
    }
  };

  viewport.addEventListener('scroll', handleScroll, { passive: true });

  // 9. ADMIN PANEL & VIDEO UPLOAD
  const updateAdminList = (customReels) => {
    adminList.innerHTML = '';

    if (customReels.length === 0) {
      adminList.innerHTML = '<div class="reels-admin-empty">Aún no has subido reels.</div>';
      return;
    }

    customReels.forEach(reel => {
      const item = document.createElement('div');
      item.className = 'reels-admin-item';

      // Temporary URL for the tiny thumbnail video
      const thumbUrl = reel.videoBlob ? URL.createObjectURL(reel.videoBlob) : reel.url;

      item.innerHTML = `
        <div class="reels-item-thumb">
          <video muted loop playsinline preload="metadata">
            <source src="${thumbUrl}" type="video/mp4">
          </video>
        </div>
        <div class="reels-item-info">
          <p class="reels-item-name">${reel.title}</p>
          <p class="reels-item-meta">${reel.videoBlob ? (reel.videoBlob.size / (1024 * 1024)).toFixed(2) + ' MB' : 'En la nube'}</p>
        </div>
        <button class="reels-item-action btn-delete-item" data-id="${reel.id}" title="Eliminar Reel">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      `;

      // Hover thumbnail to play preview
      const thumbVideo = item.querySelector('video');
      item.addEventListener('mouseenter', () => {
        thumbVideo.play().catch(() => { });
      });
      item.addEventListener('mouseleave', () => {
        thumbVideo.pause();
        thumbVideo.currentTime = 0;
      });

      // Bind delete
      item.querySelector('.btn-delete-item').addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (!verifyAdminPassword()) return;
        if (confirm('¿Deseas eliminar este Reel permanentemente?')) {
          try {
            await deleteCustomReel(id);
            localStorage.removeItem(`reels-liked-state-${id}`);
            localStorage.removeItem(`reels-likes-${id}`);
            showToast('Reel eliminado', 'error');
            await renderReels();
            handleScroll();
          } catch (err) {
            showToast('Error al borrar', 'error');
          }
        }
      });

      adminList.appendChild(item);
    });
  };

  // Toggle admin panel drawer
  const openAdminPanel = () => {
    adminPanel.classList.add('open');
    updateConnectionStatusUI();
  };
  const closeAdminPanel = () => {
    adminPanel.classList.remove('open');
    uploadForm.reset();
    dropZone.innerHTML = `
      <i class="fa-solid fa-cloud-arrow-up"></i>
      <p>Arrastra tu video aquí o haz clic</p>
      <span>Máximo 60 MB</span>
      <input type="file" id="reelsFileInput" accept="video/mp4" style="display: none;" />
    `;
    // Re-bind fileInput click
    document.getElementById('reelsFileInput').addEventListener('change', handleFileSelect);
  };

  adminBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isAdminMode) {
      openAdminPanel();
    }
  });
  adminCloseBtn.addEventListener('click', closeAdminPanel);
  modal.addEventListener('click', (e) => {
    // Click outside to close admin drawer
    if (adminPanel.classList.contains('open') && !adminPanel.contains(e.target) && !adminBtn.contains(e.target)) {
      closeAdminPanel();
    }
  });

  // Drag and Drop files handlers
  const highlightDropZone = (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  };
  const unhighlightDropZone = (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  };

  dropZone.addEventListener('dragover', highlightDropZone);
  dropZone.addEventListener('dragenter', highlightDropZone);
  dropZone.addEventListener('dragleave', unhighlightDropZone);

  let selectedFile = null;

  const handleFile = (file) => {
    if (!file) return;

    // Validate type (MP4)
    if (file.type !== 'video/mp4' && !file.name.endsWith('.mp4')) {
      showToast('Formato inválido. Debe ser un video MP4.', 'error');
      selectedFile = null;
      return;
    }

    // Validate size (max 60 MB)
    const maxSize = 60 * 1024 * 1024; // 60MB
    if (file.size > maxSize) {
      showToast('Archivo demasiado grande. Límite: 60 MB.', 'error');
      selectedFile = null;
      return;
    }

    selectedFile = file;
    dropZone.innerHTML = `
      <i class="fa-solid fa-circle-check" style="color: #8bc24f;"></i>
      <p style="font-weight: 700;">${file.name}</p>
      <span>${(file.size / (1024 * 1024)).toFixed(2)} MB • Listo para subir</span>
      <input type="file" id="reelsFileInput" accept="video/mp4" style="display: none;" />
    `;
    showToast('Video seleccionado correctamente');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    handleFile(file);
  });

  dropZone.addEventListener('click', () => {
    document.getElementById('reelsFileInput').click();
  });

  // Re-bind dynamic file input changes
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'reelsFileInput') {
      handleFileSelect(e);
    }
  });

  // Form Submission
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      showToast('Por favor, selecciona un video primero.', 'warning');
      return;
    }

    const title = titleInput.value.trim();
    const desc = descInput.value.trim();

    if (!title || !desc) {
      showToast('Completa el título y la descripción.', 'warning');
      return;
    }

    if (!verifyAdminPassword()) return;

    try {
      submitBtn.disabled = true;
      uploadProgress.classList.add('active');
      progressBarInner.style.width = '0%';
      progressPercentage.textContent = 'Procesando video...';

      // Simulate a modern chunk upload/saving indicator animation
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 8;
        if (progress > 95) clearInterval(progressInterval);
        progressBarInner.style.width = `${Math.min(95, progress)}%`;
        progressPercentage.textContent = `Procesando: ${Math.min(95, progress)}%`;
      }, 100);

      // Create new reel object
      const newReel = {
        id: `reel-${Date.now()}`,
        title: title,
        desc: desc,
        videoBlob: selectedFile,
        timestamp: Date.now()
      };

      // Save to IndexedDB
      await saveCustomReel(newReel);

      clearInterval(progressInterval);
      progressBarInner.style.width = '100%';
      progressPercentage.textContent = '100% Completado';

      setTimeout(async () => {
        showToast('¡Reel subido con éxito!');
        closeAdminPanel();
        await renderReels();

        // Scroll to the newly added reel (first in the list)
        const targetSlide = document.getElementById(`reel-slide-${newReel.id}`);
        if (targetSlide) {
          targetSlide.scrollIntoView({ behavior: 'smooth' });
        }

        // Disable loader progress UI
        uploadProgress.classList.remove('active');
        submitBtn.disabled = false;
        selectedFile = null;
      }, 500);

    } catch (err) {
      console.error(err);
      const errMsg = err.message || String(err);
      let errorText = 'Error al guardar el video.';
      if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
        errorText = 'Error de red: No se pudo conectar con Supabase. ¿El proyecto está pausado?';
      } else {
        errorText = `Error: ${errMsg}`;
      }
      showToast(errorText, 'error');
      uploadProgress.classList.remove('active');
      submitBtn.disabled = false;
    }
  });


  // 10. MODAL TOGGLE & CORE FLOW CONTROL
  const openReelsModal = async (targetReelId = null) => {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden'; // Prevent main page scrolling

    // Pause other page elements if they are playing audio/videos

    await renderReels();
    setupAutoplayObserver();

    // If deep link/specific reel is targetted
    if (targetReelId) {
      setTimeout(() => {
        const targetSlide = document.getElementById(`reel-slide-${targetReelId}`);
        if (targetSlide) {
          targetSlide.scrollIntoView({ block: 'start' });
          // Force active indicator recalculation
          handleScroll();
        } else {
          // Play the first video if target not found
          const firstVideo = viewport.querySelector('video');
          if (firstVideo) firstVideo.play().catch(() => { });
        }
      }, 350);
    } else {
      // Autoplay first video
      setTimeout(() => {
        const firstVideo = viewport.querySelector('video');
        if (firstVideo) firstVideo.play().catch(() => { });
      }, 350);
    }
  };

  const closeReelsModal = () => {
    // Pause all playing videos
    const allVideos = viewport.querySelectorAll('video');
    allVideos.forEach(v => {
      v.pause();
      v.currentTime = 0;
    });

    activeVideo = null;
    modal.classList.remove('open');
    document.body.style.overflow = ''; // Restore main page scrolling
    closeAdminPanel();

    // Remove ?reel= parameter from address bar clean and silently
    if (window.location.search.includes('reel=')) {
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }
  };

  // Bind clicks
  floatBtn.addEventListener('click', () => openReelsModal());
  closeBtn.addEventListener('click', closeReelsModal);

  // Esc key closure support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (adminPanel.classList.contains('open')) {
        closeAdminPanel();
      } else if (modal.classList.contains('open')) {
        closeReelsModal();
      }
    }
  });

  // 11. DEEP LINK INITIALIZER
  const initDeepLink = async () => {
    await initDB();

    const params = new URLSearchParams(window.location.search);

    // Check for admin mode URL parameter
    if (params.has('admin')) {
      if (verifyAdminPassword()) {
        sessionStorage.setItem('reelsAdminMode', 'true');
        isAdminMode = true;
        showToast('Modo administrador activado');
      } else {
        sessionStorage.removeItem('reelsAdminMode');
        isAdminMode = false;
      }

      // Silently clean URL parameter
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }

    // Toggle admin button display state
    const adminButton = document.getElementById('reelsAdminBtn');
    if (adminButton) {
      adminButton.style.display = isAdminMode ? 'flex' : 'none';
    }

    // Check url search params for ?reel=
    const targetReelId = params.get('reel');

    if (targetReelId) {
      openReelsModal(targetReelId);
    }
  };

  // Expose function globally so inline onclick handlers in homepage cards can call it
  window.openReelsModal = openReelsModal;

  initDeepLink();

  // Dynamically load Supabase script at the very end of initialization if credentials are set
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = async () => {
      await initSupabase();
      renderReels();
    };
    document.head.appendChild(script);
  }
});
