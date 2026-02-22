// Centrale versiebron voor app en service worker
const APP_VERSION = '3.2.6';

// Changelog voor het uitklapbare "Changes"-luik in de Info-tab.
// Voeg nieuwe releases bovenaan toe.
// Inhoud gebaseerd op git-geschiedenis van version.js + recente lokale wijzigingen.
const APP_CHANGELOG = [
    {
        version: '3.2.6',
        title: 'Delen vereenvoudigd (2 knoppen + desktop klembordflow)',
        changes: [
            'In Delen zijn rapportacties vereenvoudigd naar 2 knoppen: zonder foto’s en met foto’s.',
            'Mobiel gebruikt nu expliciet het native deelmenu voor beide rapportknoppen.',
            'Desktop kopieert naar het klembord met duidelijke melding; bij rapport met foto’s wordt rich clipboard (tekst + foto’s) geprobeerd met nette fallback.'
        ]
    },
    {
        version: '3.2.5',
        title: 'Rapportnotities uitgebreid + hulptekst opgeschoond',
        changes: [
            'Dagrapport toont nu notities van alle geselecteerde sessies, met tellernaam erbij.',
            'Algemene dagnota blijft mee opgenomen in het rapport onder hetzelfde notitieblok.',
            'Hulptekst opgeschoond: QR-regel, oude determinatie-dropdown-vermelding en route/weer-waarschuwing verwijderd.'
        ]
    },
    {
        version: '3.2.4',
        title: 'Navigatie/Help update + determinatie volgt headerselectie',
        changes: [
            'Mobiele ondernavigatie gecentreerd en gecorrigeerd naar 5 gelijke tabkolommen.',
            'Hulp-tab herschreven naar de huidige flow (sessie-wizard, delen/import, sessiebeheer in instellingen).',
            'In determinatie is de aparte sessie-dropdown verwijderd; de telling wordt nu gekozen via de headerselector bovenaan.'
        ]
    },
    {
        version: '3.2.3',
        title: 'Deellink UX verbeterd + QR tijdelijk verborgen',
        changes: [
            'Duidelijkere instructies toegevoegd bij kopiëren/delen van deellinks.',
            'Deelknop opent op smartphones het native deelmenu; op desktop wordt de link gekopieerd met duidelijke plak-instructie in modal.',
            'QR-functionaliteit tijdelijk verborgen in de UI (delen en wizard) in afwachting van URL-shortener aanpak.'
        ]
    },
    {
        version: '3.2.2',
        title: 'QR payload compacter gemaakt',
        changes: [
            'QR payload voor sessie/dagdeling geoptimaliseerd: nulwaarden worden niet meer meegestuurd.',
            'Alleen custom soorten die effectief in de gedeelde telling zitten worden nog opgenomen.',
            'QR byte-limiet iets verhoogd voor betere slaagkans, met behoud van veilige fallback naar deel-link.'
        ]
    },
    {
        version: '3.2.1',
        title: 'QR stabiliteitsfix (payload grootte)',
        changes: [
            'QR-generatie gebruikt nu byte-grootte i.p.v. tekenlengte voor limietcontrole.',
            'Overflow bij grote payloads wordt netjes afgehandeld zonder uncaught error.',
            'Bij te grote payload schakelt de wizard automatisch over naar deel-link als fallback.'
        ]
    },
    {
        version: '3.2.0',
        title: 'Sessie-afrond wizard + delenflow vereenvoudigd',
        changes: [
            'Na het stoppen van een sessie opent nu een wizard met naam, traject, weer en notities.',
            'Naam en traject worden automatisch onthouden en voorgesteld bij de volgende sessie.',
            'In de wizard kan je meteen kiezen: rapporttekst delen, sessie delen via link, of QR maken en downloaden.',
            'Tab "Delen" opgeschoond: route/weer/notities en handmatige naam/traject-invoer zijn verplaatst naar de sessie-wizard.',
            'Tab "Sessies" dient als nazichtscherm om wizardgegevens per sessie te controleren en te corrigeren.'
        ]
    },
    {
        version: '3.1.2',
        title: 'UI hotfix: uniforme tellerknoppen',
        changes: [
            'De + en - knoppen in de teller zijn nu exact even groot op alle schermformaten.',
            'Layout van de teller-rij gestabiliseerd zodat labels zoals "Paar", "Man" en "Vrouw" knopgroottes niet meer visueel beïnvloeden.'
        ]
    },
    {
        version: '3.1.1',
        title: 'Hotfix teller + sleutelmigratie',
        changes: [
            'Bug opgelost waarbij +1/-1 geen zichtbare tellerupdate meer gaf na de nieuwe tellerlayout.',
            'Telsleutels weer gestandaardiseerd op het bestaande schema (`p_l`, `m_l`, ...), zodat rapporten en totalen opnieuw kloppen.',
            'Automatische migratie toegevoegd voor sessies met tijdelijke sleutels zoals `pair_live`/`f_dead`.'
        ]
    },
    {
        version: '3.1.0',
        title: 'Grote UX-update: Delen & instellingen',
        changes: [
            'Vereenvoudigde navigatie: "Geschiedenis" heet nu "Sessies".',
            'Vernieuwde "Delen"-tab: Alles op één plek (Details wissen, Samen Tellen, Rapport delen).',
            'Sessie-details (weer, route, notities) verplaatst naar de deel-flow voor vlotter gebruik.',
            'Opkuis instellingen: Geavanceerde opties standaard verborgen (ontwikkelaarsmodus).',
            'Visuele update teller: Duidelijker onderscheid tussen levend en dood.'
        ]
    },
    {
        version: '3.0.7',
        title: 'Google Analytics integratie',
        changes: [
            'Google Analytics toegevoegd voor inzicht in gebruik (aantallen, versies, determinaties).',
            'Privacy-vriendelijke tracking van app-gebruik en telactiviteit.'
        ]
    },
    {
        version: '3.0.6',
        title: 'Rapportage verbeterd + visuele updates',
        changes: [
            'Rapportage verder verbeterd voor duidelijkere output en gebruik.',
            'Enkele visuele aanpassingen doorgevoerd in de interface.'
        ]
    },
    {
        version: '3.0.5',
        title: 'Rapport ontdubbeld + changes-luik + hard refresh',
        changes: [
            'Service-worker hard refresh/updateflow aangescherpt.',
            'Rapportage verbeterd: traject en weer worden in dagrapporten ontdubbeld zodat samengevoegde sessies geen dubbele metadata tonen.',
            'Info-tab uitgebreid met uitklapbaar "Changes"-luik voor versiehistoriek.'
        ]
    },
    {
        version: '3.0.4',
        title: 'Start v3-lijn: opslagmigratie naar IndexedDB',
        changes: [
            'Foto-opslag verhuisd van grote localStorage data-URLs naar IndexedDB refs.',
            'Automatische migratie toegevoegd zodat bestaande foto-data behouden blijft.',
            'Fallback voorzien: bij IndexedDB-problemen blijft opslaan mogelijk via localStorage.',
            'Beheer-tools toegevoegd voor migratiecontrole en opschonen van oude versie-keys.'
        ]
    },
    {
        version: '2.3.6',
        title: 'Verbeteringen',
        changes: [
            'Diverse verbeteringen in app-flow en UX.'
        ]
    },
    {
        version: '2.3.4',
        title: 'Vereenvoudiging',
        changes: [
            'Schermen en handelingen vereenvoudigd voor sneller gebruik.'
        ]
    },
    {
        version: '2.3.0',
        title: 'UX update + delen via link',
        changes: [
            'Delen via links toegevoegd: verstuur je telling als deel-link en importeer die als aparte sessie op een ander toestel.',
            'Extra UX-aanpassingen in de deel- en instellingenflow.'
        ]
    },
    {
        version: '2.2.3',
        title: 'Updates',
        changes: [
            'Algemene updates aan app, interface en service worker.'
        ]
    },
    {
        version: '2.2.1',
        title: 'Onderhoudsbump',
        changes: [
            'Kleine onderhoudsupdate en versieverhoging.'
        ]
    },
    {
        version: '2.2.0',
        title: 'Shipping',
        changes: [
            'Lokale vendor-libraries en offline assets toegevoegd.',
            'Manifest, iconen en service-worker cachelijst uitgebreid voor stabielere PWA.'
        ]
    },
    {
        version: '2.0.0',
        title: 'Determinatie release',
        changes: [
            'Determinatie-functionaliteit en soortafbeeldingen toegevoegd.'
        ]
    },
    {
        version: '1.x.x',
        title: 'Geen 1.x-lijn in git-historiek',
        changes: [
            'In de git-geschiedenis van version.js zijn geen 1.x versienummers teruggevonden.',
            'De semver-lijn springt van 0.7 rechtstreeks naar 2.0.0.'
        ]
    },
    {
        version: '0.7',
        title: 'Wikiverwijdering',
        changes: [
            'Wikipedia-verwijzingen in determinatie aangepast/verwijderd.'
        ]
    },
    {
        version: '0.6',
        title: 'Wikipedia toevoeging',
        changes: [
            'Wikipedia-koppeling toegevoegd aan determinatie.'
        ]
    },
    {
        version: '0.5',
        title: 'Determinatiehulp',
        changes: [
            'Eerste versie van de determinatiehulp toegevoegd.'
        ]
    },
    {
        version: '0.4',
        title: 'Opschoning',
        changes: [
            'Tijdelijke codebestanden opgeruimd.'
        ]
    },
    {
        version: '0.3',
        title: 'Haptic feedback',
        changes: [
            'Haptische feedback toegevoegd.'
        ]
    },
    {
        version: '0.1',
        title: 'Eerste werkende PWA-versie',
        changes: [
            'Basisversie met service worker, versiebeheer en offline-statusindicator.'
        ]
    },
    {
        version: 'v18',
        title: 'Pre-semver update',
        changes: [
            'Delen verder verbeterd.'
        ]
    },
    {
        version: 'v17',
        title: 'Pre-semver update',
        changes: [
            'Algemene updates in de vroege appfase.'
        ]
    },
    {
        version: 'v14',
        title: 'Pre-semver update',
        changes: [
            'Sessies en finetuning toegevoegd.'
        ]
    },
    {
        version: 'v13',
        title: 'Start van version.js',
        changes: [
            'Eerste centrale versiebron (`version.js`) ingevoerd.'
        ]
    }
];
