import { config, database, logger, changePanel, appdata, setStatus, pkg, popup } from '../utils.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')

class Home {
    static id = "home";
    
    async init(config) {
        console.log('[DEBUG] Initializing Home panel');
        try {
            this.config = config;
            this.db = new database();
            console.log('[DEBUG] Database instance created');
            
            // Add null checks before operations
            if (!document.querySelector('.news-list')) {
                console.warn('[DEBUG] News list element not found');
            } else {
                await this.news();
            }
            console.log('[DEBUG] News loaded');
            
            this.socialLick();
            console.log('[DEBUG] Social links initialized');
            
            await this.instancesSelect();
            console.log('[DEBUG] Instances selection initialized');
            
            const settingsBtn = document.querySelector('.settings-btn');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', () => {
                    console.log('[DEBUG] Settings button clicked');
                    changePanel('settings');
                });
            }
            
            console.log('[DEBUG] Home panel initialization complete');
        } catch (err) {
            console.error('[DEBUG] Error in Home init:', err);
        }
    }

    async news() {
        console.log('[DEBUG] Fetching news');
        try {
            let newsElement = document.querySelector('.news-list');
            let news = await config.getNews().then(res => {
                console.log('[DEBUG] News fetched:', res);
                return res;
            }).catch(err => {
                console.error('[DEBUG] News fetch error:', err);
                return false;
            });
            if (news) {
                if (!news.length) {
                    let blockNews = document.createElement('div');
                    blockNews.classList.add('news-block');
                    blockNews.innerHTML = `
                        <div class="news-header">
                            <img class="server-status-icon" src="assets/images/icon.png">
                            <div class="header-text">
                                <div class="title">Aucun news n'est actuellement disponible.</div>
                            </div>
                            <div class="date">
                                <div class="day">1</div>
                                <div class="month">Janvier</div>
                            </div>
                        </div>
                        <div class="news-content">
                            <div class="bbWrapper">
                                <p>Vous pourrez suivre ici toutes les news relatives au serveur.</p>
                            </div>
                        </div>`
                    newsElement.appendChild(blockNews);
                } else {
                    for (let News of news) {
                        let date = this.getdate(News.publish_date)
                        let blockNews = document.createElement('div');
                        blockNews.classList.add('news-block');
                        blockNews.innerHTML = `
                            <div class="news-header">
                                <img class="server-status-icon" src="assets/images/icon.png">
                                <div class="header-text">
                                    <div class="title">${News.title}</div>
                                </div>
                                <div class="date">
                                    <div class="day">${date.day}</div>
                                    <div class="month">${date.month}</div>
                                </div>
                            </div>
                            <div class="news-content">
                                <div class="bbWrapper">
                                    <p>${News.content.replace(/\n/g, '</br>')}</p>
                                    <p class="news-author">Auteur - <span>${News.author}</span></p>
                                </div>
                            </div>`
                        newsElement.appendChild(blockNews);
                    }
                }
            } else {
                let blockNews = document.createElement('div');
                blockNews.classList.add('news-block');
                blockNews.innerHTML = `
                    <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon.png">
                        <div class="header-text">
                            <div class="title">Error.</div>
                        </div>
                        <div class="date">
                            <div class="day">1</div>
                            <div class="month">Janvier</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>Impossible de contacter le serveur des news.</br>Merci de vérifier votre configuration.</p>
                        </div>
                    </div>`
                newsElement.appendChild(blockNews);
            }
        } catch (err) {
            console.error('[DEBUG] Error in news method:', err);
        }
    }

    socialLick() {
        let socials = document.querySelectorAll('.social-block')

        socials.forEach(social => {
            social.addEventListener('click', e => {
                shell.openExternal(e.target.dataset.url)
            })
        });
    }

    async instancesSelect() {
        console.log('[DEBUG] Starting instances selection');
        try {
            let configClient = await this.db.readData('configClient');
            console.log('[DEBUG] Config client:', configClient);
            
            let auth = await this.db.readData('accounts', configClient.account_selected);
            console.log('[DEBUG] Auth data:', auth);
            
            let instancesList = await config.getInstanceList();
            console.log('[DEBUG] Instances list:', instancesList);
            
            let instanceSelect = instancesList.find(i => i.name == configClient?.instance_selct) ? configClient?.instance_selct : null

            let playInstanceBTN = document.querySelector('.play-instance')
            let instancePopup = document.querySelector('.instance-popup')
            let instancesListPopup = document.querySelector('.instances-List')
            let instanceCloseBTN = document.querySelector('.close-popup')
            let playBtn = document.querySelector('.play-btn')
            let instanceSelectBtn = document.querySelector('.instance-select')

            if (instancesList.length === 1) {
                instanceSelectBtn.style.display = 'none'
                playInstanceBTN.style.paddingRight = '0'
            }

            if (!instanceSelect) {
                let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                configClient.instance_selct = newInstanceSelect.name
                instanceSelect = newInstanceSelect.name
                await this.db.updateData('configClient', configClient)
            }

            playBtn.addEventListener('click', () => this.startGame())

            instanceSelectBtn.addEventListener('click', () => {
                this.showInstancePopup(instancesListPopup, instancesList, instanceSelect, auth)
                instancePopup.style.display = 'flex'
            })

            instanceCloseBTN.addEventListener('click', () => instancePopup.style.display = 'none')

            instancePopup.addEventListener('click', async (e) => {
                if (e.target.classList.contains('instance-elements')) {
                    let newInstanceSelect = e.target.id
                    let activeInstanceSelect = document.querySelector('.active-instance')

                    if (activeInstanceSelect) activeInstanceSelect.classList.toggle('active-instance')
                    e.target.classList.add('active-instance')

                    configClient.instance_selct = newInstanceSelect
                    await this.db.updateData('configClient', configClient)
                    instanceSelect = instancesList.find(i => i.name == newInstanceSelect)
                    instancePopup.style.display = 'none'
                    let instance = await config.getInstanceList()
                    let options = instance.find(i => i.name == configClient.instance_selct)
                    await setStatus(options.status)
                }
            })

            for (let instance of instancesList) {
                if (instance.whitelistActive) {
                    let whitelist = instance.whitelist.find(whitelist => whitelist == auth?.name)
                    if (whitelist !== auth?.name && instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        configClient.instance_selct = newInstanceSelect.name
                        instanceSelect = newInstanceSelect.name
                        setStatus(newInstanceSelect.status)
                        await this.db.updateData('configClient', configClient)
                    }
                }
                if (instance.name == instanceSelect) setStatus(instance.status)
            }
        } catch (err) {
            console.error('[DEBUG] Error in instancesSelect:', err);
        }
    }

    showInstancePopup(instancesListPopup, instancesList, instanceSelect, auth) {
        instancesListPopup.innerHTML = ''
        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                instance.whitelist.map(whitelist => {
                    if (whitelist == auth?.name) {
                        this.addInstanceElement(instancesListPopup, instance, instanceSelect)
                    }
                })
            } else {
                this.addInstanceElement(instancesListPopup, instance, instanceSelect)
            }
        }
    }

    addInstanceElement(instancesListPopup, instance, instanceSelect) {
        let element = document.createElement('div')
        element.id = instance.name
        element.classList.add('instance-elements')
        if (instance.name == instanceSelect) element.classList.add('active-instance')
        element.textContent = instance.name
        instancesListPopup.appendChild(element)
    }

    async startGame() {
        console.log('[DEBUG] Starting game launch process');
        try {
            let configClient = await this.db.readData('configClient');
            if (!configClient) {
                throw new Error('Config client not found');
            }
            console.log('[DEBUG] Launch config:', configClient);
            
            // Add verification for required files
            const requiredFiles = [
                'loader/forge/libraries/org/ow2/asm/asm-commons/9.7.1/asm-commons-9.7.1.jar',
                // Add other critical files here
            ];

            for (const file of requiredFiles) {
                try {
                    // Add file verification logic here
                    console.log(`[DEBUG] Verifying file: ${file}`);
                } catch (err) {
                    throw new Error(`Required file missing or corrupted: ${file}`);
                }
            }

            let instance = await config.getInstanceList()
            let authenticator = await this.db.readData('accounts', configClient.account_selected)
            let options = instance.find(i => i.name == configClient.instance_selct)

            let playInstanceBTN = document.querySelector('.play-instance')
            let infoStartingBOX = document.querySelector('.info-starting-game')
            let infoStarting = document.querySelector(".info-starting-game-text")
            let progressBar = document.querySelector('.progress-bar')

            let opt = {
                url: options.url,
                authenticator: authenticator,
                timeout: 10000,
                path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
                instance: options.name,
                version: options.loadder.minecraft_version,
                detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,
                downloadFileMultiple: configClient.launcher_config.download_multi,
                intelEnabledMac: configClient.launcher_config.intelEnabledMac,

                loader: {
                    type: options.loadder.loadder_type,
                    build: options.loadder.loadder_version,
                    enable: options.loadder.loadder_type == 'none' ? false : true
                },

                verify: options.verify,

                ignored: [...options.ignored],

                javaPath: configClient.java_config.java_path,

                screen: {
                    width: configClient.game_config.screen_size.width,
                    height: configClient.game_config.screen_size.height
                },

                memory: {
                    min: `${configClient.java_config.java_memory.min * 1024}M`,
                    max: `${configClient.java_config.java_memory.max * 1024}M`
                }
            }

            const launch = new Launch();

            launch.Launch(opt);

            if (playInstanceBTN) playInstanceBTN.style.display = "none"
            if (infoStartingBOX) infoStartingBOX.style.display = "block"
            if (infoStarting) infoStarting.style.opacity = "1"
            if (progressBar) progressBar.style.display = "block"
            
            ipcRenderer.send('main-window-progress-load')

            launch.on('extract', extract => {
                console.log('[DEBUG] Extraction event:', extract);
                ipcRenderer.send('main-window-progress-load')
                infoStarting.textContent = `Extraction en cours...`
                console.log(extract);
            });

            launch.on('progress', (progress, size) => {
                console.log('[DEBUG] Download progress:', progress, '/', size);
                // Validate progress and size are finite numbers
                if (!isFinite(progress) || !isFinite(size) || size === 0) {
                    console.error('[DEBUG] Invalid progress values:', { progress, size });
                    return;
                }
                
                const percentage = ((progress / size) * 100).toFixed(0);
                infoStarting.textContent = `Téléchargement ${percentage}%`;
                ipcRenderer.send('main-window-progress', { progress, size });
                
                if (progressBar) {
                    progressBar.value = Math.min(Math.max(0, progress), size); // Ensure value is between 0 and size
                    progressBar.max = size;
                }
            });

            launch.on('check', (progress, size) => {
                infoStarting.textContent = `Vérification ${((progress / size) * 100).toFixed(0)}%`
                ipcRenderer.send('main-window-progress', { progress, size })
                if (progressBar) {
                    progressBar.value = progress;
                    progressBar.max = size;
                }
            });

            launch.on('patch', patch => {
                console.log('[DEBUG] Patch event:', patch);
                ipcRenderer.send('main-window-progress-load')
                infoStarting.textContent = `Patch en cours...`
            });

            launch.on('data', (e) => {
                if (progressBar) progressBar.style.display = "none"
                if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                    ipcRenderer.send("main-window-hide")
                };
                new logger('Minecraft', '#36b030');
                ipcRenderer.send('main-window-progress-load')
                infoStarting.textContent = `Démarrage en cours...`
                console.log(e);
            })

            launch.on('close', code => {
                if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                    ipcRenderer.send("main-window-show")
                };
                ipcRenderer.send('main-window-progress-reset')
                if (infoStartingBOX) infoStartingBOX.style.display = "none"
                if (playInstanceBTN) playInstanceBTN.style.display = "flex"
                infoStarting.textContent = `Vérification`
                new logger(pkg.name, '#7289da');
                console.log('Close');
            });

            launch.on('error', err => {
                console.error('[DEBUG] Launch error:', err);
                let errorMessage = 'An error occurred during launch';
                
                if (err.error && err.error.includes('zip file is empty')) {
                    errorMessage = 'Required game files are corrupted. Please try reinstalling the game.';
                }
                
                let popupError = new popup();
                popupError.openPopup({
                    title: 'Erreur',
                    content: errorMessage,
                    color: 'red',
                    options: true
                });

                if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                    ipcRenderer.send("main-window-show");
                }
                ipcRenderer.send('main-window-progress-reset');
                
                if (infoStartingBOX) infoStartingBOX.style.display = "none";
                if (playInstanceBTN) playInstanceBTN.style.display = "flex";
                if (infoStarting) infoStarting.textContent = `Vérification`;
                
                new logger(pkg.name, '#7289da');
                console.log(err);
            });
            
            console.log('[DEBUG] Game launch initialized with options:', opt);
        } catch (err) {
            console.error('[DEBUG] Critical error in startGame:', err);
            let popupError = new popup();
            popupError.openPopup({
                title: 'Critical Error',
                content: err.message,
                color: 'red',
                options: true
            });
        }
    }

    getdate(e) {
        let date = new Date(e)
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let day = date.getDate()
        let allMonth = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
        return { year: year, month: allMonth[month - 1], day: day }
    }
}

export default Home;