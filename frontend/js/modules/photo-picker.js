/* =============================================================================
   MedCare front end - the profile-picture window
   -----------------------------------------------------------------------------
   One window, used by every type of account (patient, doctor, receptionist,
   administrator), so a person can put their own face on their profile:

     1. take a picture with the camera on a telephone, or choose a file;
     2. choose a picture from the clinic's own library;
     3. slide and zoom the picture until the face sits nicely in the circle;
     4. save it - the clinic stores it against the account and it appears
        everywhere that person is shown.

   The window is deliberately self-contained: it needs the modal helper, the
   server call and (when it is available) the Cropper.js library that the npm
   bundle ships.  If Cropper.js is missing the picture is simply saved as it is,
   so the feature degrades instead of breaking.
   ========================================================================== */

let picker = null;          // the running window, if one is open

/**
 * Opens the picture window.
 *
 * @param {object}   deps    { modal, api, toast, icons, escape }
 *        deps.modal   builds a modal on this page
 *        deps.api     performs a signed-in request
 *        deps.toast   shows a short confirmation
 *        deps.drawIcons  redraws the icon set
 *        deps.escape  escapes text before it is written into the page
 * @param {object}   person  { id, fullName, photo, roleLabel }
 * @param {function} onSaved called with the refreshed record after saving
 */
export function openPhotoWindow(deps, person, onSaved) {
    if (picker) {
        picker.close();
    }
    const { modal, api, toast, drawIcons, escape } = deps;
    const libs = window.MedCare || {};
    const Cropper = libs.Cropper || (libs.cropper && libs.cropper.default) || null;

    let chosenData = null;      // the picture the person picked (as a data address)
    let chosenName = '';
    const state = { cropper: null, library: [], mode: 'library' };

    const body = `
        <div class="pp-grid">
            <div>
                <div class="pp-steps">
                    <button class="btn btn-ghost btn-sm" data-pp="tab-file" type="button">
                        <i data-lucide="camera" class="ico-16"></i> Take or choose a picture
                    </button>
                    <button class="btn btn-primary btn-sm" data-pp="tab-library" type="button">
                        <i data-lucide="images" class="ico-16"></i> Clinic library
                    </button>
                </div>

                <div data-pp="pane-file" class="pp-hidden">
                    <div class="pp-drop" data-pp="drop">
                        <i data-lucide="upload-cloud" class="ico-22"></i>
                        <p style="margin:8px 0 4px">Drag a picture here, or</p>
                        <label class="btn btn-ghost btn-sm" style="display:inline-flex">
                            <i data-lucide="folder-open" class="ico-16"></i> Choose a file
                            <input type="file" accept="image/*" data-pp="file" hidden>
                        </label>
                        <p class="pp-note" style="margin-top:8px">JPG, PNG, GIF or WEBP up to 8 MB.
                            A square picture works best.</p>
                    </div>
                    <div class="pp-crop-stage pp-hidden" data-pp="stage">
                        <img data-pp="source" alt="The picture being prepared">
                    </div>
                    <div class="pp-actions" data-pp="crop-actions" style="margin-top:10px; display:none">
                        <button class="btn btn-ghost btn-sm" data-pp="zoom-out" type="button">
                            <i data-lucide="zoom-out" class="ico-16"></i> Smaller
                        </button>
                        <button class="btn btn-ghost btn-sm" data-pp="zoom-in" type="button">
                            <i data-lucide="zoom-in" class="ico-16"></i> Bigger
                        </button>
                        <button class="btn btn-ghost btn-sm" data-pp="rotate" type="button">
                            <i data-lucide="rotate-cw" class="ico-16"></i> Turn
                        </button>
                        <button class="btn btn-ghost btn-sm" data-pp="reset" type="button">
                            <i data-lucide="undo-2" class="ico-16"></i> Start again
                        </button>
                    </div>
                </div>

                <div data-pp="pane-library">
                    <div class="pp-head">
                        <h4>Pictures from the clinic</h4>
                        <span class="pp-note" data-pp="count"></span>
                    </div>
                    <div class="pp-library" data-pp="library"></div>
                </div>
            </div>

            <div class="pp-preview">
                <div class="pp-stage">
                    <img data-pp="preview" alt="How the picture will look on the profile"
                         src="/${escape(person.photo || 'img/people/default-avatar.svg')}">
                </div>
                <div class="pp-note" data-pp="hint">This is how the picture will appear on the profile,
                    in the lists and beside appointments.</div>
                <div class="pp-actions">
                    <button class="btn btn-ghost btn-sm" data-pp="remove" type="button">
                        <i data-lucide="trash-2" class="ico-16"></i> Remove my picture
                    </button>
                </div>
            </div>
        </div>`;

    const footer = `
        <button class="btn btn-ghost" data-act="cancel" type="button">Not now</button>
        <button class="btn btn-primary" data-pp="save" type="button" disabled>
            <i data-lucide="check" class="ico-16"></i> Use this picture
        </button>`;

    const window_ = modal({
        title: `Picture of ${person.fullName || 'this person'}`,
        subtitle: 'Patients, doctors and staff all manage their own picture here.',
        body,
        footer,
        wide: true,
        onMount: (root) => setUpWindow(root)
    });
    picker = window_;

    function setUpWindow(root) {
        const $ = (selector) => root.querySelector(selector);
        const preview = $('[data-pp="preview"]');
        const libraryBox = $('[data-pp="library"]');
        const fileInput = $('[data-pp="file"]');
        const source = $('[data-pp="source"]');
        const stage = $('[data-pp="stage"]');
        const cropActions = $('[data-pp="crop-actions"]');
        const saveButton = $('[data-pp="save"]');
        const drop = $('[data-pp="drop"]');

        const showPane = (which) => {
            state.mode = which;
            $('[data-pp="pane-file"]').classList.toggle('pp-hidden', which !== 'file');
            $('[data-pp="pane-library"]').classList.toggle('pp-hidden', which !== 'library');
            $('[data-pp="tab-file"]').className = which === 'file' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm';
            $('[data-pp="tab-library"]').className = which === 'library' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm';
        };

        const refreshSave = () => { saveButton.disabled = !chosenData; };

        /* ---------------------------------------------------- library pane */
        api('/photos/library').then((data) => {
            state.library = data.library || [];
            libraryBox.innerHTML = state.library.map((entry) => `
                <button class="pp-pick${person.photo && person.photo.endsWith(entry.file) ? ' is-chosen' : ''}"
                        type="button" data-file="${escape(entry.file)}" title="${escape(entry.label)}">
                    <img src="/${escape(entry.url)}" alt="${escape(entry.label)}">
                    <span class="pp-tick"><i data-lucide="check" class="ico-14"></i></span>
                </button>`).join('');
            $('[data-pp="count"]').textContent = `${state.library.length} pictures available`;
            drawIcons(libraryBox);
            libraryBox.addEventListener('click', (event) => {
                const button = event.target.closest('[data-file]');
                if (!button) {
                    return;
                }
                libraryBox.querySelectorAll('.pp-pick').forEach(node => node.classList.remove('is-chosen'));
                button.classList.add('is-chosen');
                chosenData = null;
                state.libraryChoice = button.dataset.file;
                preview.src = button.querySelector('img').src;
                $('[data-pp="hint"]').textContent = 'This picture from the clinic library will be used on the profile.';
                saveButton.disabled = false;
            });
        }).catch(() => {
            libraryBox.innerHTML = '<p class="pp-note">The clinic pictures could not be loaded just now - you can still take or choose your own picture.</p>';
        });

        /* ------------------------------------------------------- file pane */
        const startCrop = (dataAddress, fileName) => {
            chosenData = dataAddress;
            chosenName = fileName || 'picture';
            state.libraryChoice = null;
            stage.classList.remove('pp-hidden');
            cropActions.style.display = 'flex';
            drop.classList.add('pp-hidden');
            source.src = dataAddress;
            preview.src = dataAddress;
            $('[data-pp="hint"]').textContent = 'Slide the picture to place the face in the circle, then use “Use this picture”.';
            refreshSave();
            if (Cropper) {
                if (state.cropper) {
                    state.cropper.destroy();
                }
                state.cropper = new Cropper(source, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 1,
                    background: false,
                    responsive: true,
                    guides: false,
                    cropBoxMovable: false,
                    cropBoxResizable: false,
                    toggleDragModeOnDblclick: false
                });
            }
        };

        const readFile = (file) => {
            if (!file) {
                return;
            }
            if (!/^image\//.test(file.type)) {
                toast('That file is not a picture - please choose a JPG, PNG or WEBP image', 'error');
                return;
            }
            if (file.size > 8 * 1024 * 1024) {
                toast('That picture is larger than 8 MB - please choose a smaller one', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => startCrop(String(reader.result), file.name);
            reader.readAsDataURL(file);
        };

        fileInput.addEventListener('change', () => readFile(fileInput.files[0]));

        ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, (event) => {
            event.preventDefault();
            drop.classList.add('is-over');
        }));
        ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, (event) => {
            event.preventDefault();
            drop.classList.remove('is-over');
        }));
        drop.addEventListener('drop', (event) => readFile(event.dataTransfer.files[0]));

        root.addEventListener('click', (event) => {
            const action = event.target.closest('[data-pp]');
            if (!action) {
                return;
            }
            const name = action.dataset.pp;
            if (name === 'tab-file' || name === 'tab-library') {
                showPane(name === 'tab-file' ? 'file' : 'library');
            } else if (name === 'zoom-in' && state.cropper) {
                state.cropper.zoom(0.1);
            } else if (name === 'zoom-out' && state.cropper) {
                state.cropper.zoom(-0.1);
            } else if (name === 'rotate' && state.cropper) {
                state.cropper.rotate(90);
            } else if (name === 'reset') {
                stage.classList.add('pp-hidden');
                cropActions.style.display = 'none';
                drop.classList.remove('pp-hidden');
                fileInput.value = '';
                chosenData = null;
                if (state.cropper) {
                    state.cropper.destroy();
                    state.cropper = null;
                }
                preview.src = `/${person.photo || 'img/people/default-avatar.svg'}`;
                refreshSave();
            }
        });

        /* ----------------------------------------------------------- save */
        saveButton.addEventListener('click', async () => {
            saveButton.disabled = true;
            const original = saveButton.innerHTML;
            saveButton.textContent = 'Saving...';
            try {
                let payload;
                let format = 'library';
                if (state.libraryChoice) {
                    payload = state.libraryChoice;
                } else if (chosenData) {
                    format = 'base64';
                    payload = chosenData;
                    if (state.cropper) {
                        // Only the part inside the circle is kept, in a sensible size.
                        payload = state.cropper.getCroppedCanvas({
                            width: 512,
                            height: 512,
                            imageSmoothingQuality: 'high'
                        }).toDataURL('image/jpeg', 0.92);
                    }
                } else {
                    saveButton.innerHTML = original;
                    refreshSave();
                    return;
                }
                const data = await api(`/photos/${person.id}`, {
                    method: 'POST',
                    body: { format, payload, fileName: chosenName }
                });
                toast(data.message || 'Profile picture updated');
                const user = data.user || {};
                if (onSaved) {
                    onSaved(user);
                }
                window_.close();
            } catch (error) {
                toast(error.message || 'The picture could not be saved', 'error');
                saveButton.innerHTML = original;
                refreshSave();
            }
        });

        /* --------------------------------------------------------- remove */
        $('[data-pp="remove"]').addEventListener('click', async () => {
            try {
                const data = await api(`/photos/${person.id}`, { method: 'DELETE' });
                toast(data.message || 'The default picture is shown again');
                const user = data.user || {};
                if (onSaved) {
                    onSaved(user);
                }
                window_.close();
            } catch (error) {
                toast(error.message || 'The picture could not be removed', 'error');
            }
        });

        showPane('library');
        drawIcons(root);
    }

    return window_;
}
