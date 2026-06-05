const ADMIN_CODE = "spiess2026";

let istAdmin = false;

let zugname = localStorage.getItem("zugname") || "Digitaler Strafenkatalog";
let logo = localStorage.getItem("logo") || "";

let schuetzen = JSON.parse(localStorage.getItem("schuetzen")) || [];
let strafarten = JSON.parse(localStorage.getItem("strafarten")) || [];
let strafen = JSON.parse(localStorage.getItem("strafen")) || [];
let anwesenheiten = JSON.parse(
    localStorage.getItem("anwesenheiten")
) || [];
function speichern() {
    localStorage.setItem("zugname", zugname);
    localStorage.setItem("logo", logo);
    localStorage.setItem("schuetzen", JSON.stringify(schuetzen));
    localStorage.setItem("strafarten", JSON.stringify(strafarten));
    localStorage.setItem("strafen", JSON.stringify(strafen));
    localStorage.setItem("anwesenheiten", JSON.stringify(anwesenheiten));
}

function adminEinloggen() {
    const code = document.getElementById("adminCode").value;

    if (code === ADMIN_CODE) {
        istAdmin = true;
        document.getElementById("adminCode").value = "";
        appAktualisieren();
    } else {
        alert("Falscher Admin-Code.");
    }
}

function adminAusloggen() {
    istAdmin = false;
    appAktualisieren();
}

function zugnameSpeichern() {
    const neuerName = document.getElementById("zugnameInput").value.trim();

    if (!neuerName) {
        alert("Bitte einen Zugnamen eingeben.");
        return;
    }

    zugname = neuerName;
    document.getElementById("zugnameInput").value = "";
    speichern();
    appAktualisieren();
}

function logoSpeichern() {
    const datei = document.getElementById("logoInput").files[0];

    if (!datei) {
        alert("Bitte ein Logo auswählen.");
        return;
    }

    const reader = new FileReader();

    reader.onload = function(event) {
        logo = event.target.result;
        speichern();
        appAktualisieren();
    };

    reader.readAsDataURL(datei);
}

function schuetzeHinzufuegen() {

    const name = document.getElementById("neuerSchuetze").value;
    const rolle = document.getElementById("rolleSelect").value;
if (
    rolle === "Spieß" &&
    schuetzen.some(s => s.rolle === "Spieß")
) {
    alert("Es darf nur einen Spieß geben.");
    return;
}

if (
    rolle === "Oberleutnant" &&
    schuetzen.some(s => s.rolle === "Oberleutnant")
) {
    alert("Es darf nur einen Oberleutnant geben.");
    return;
}

if (
    rolle === "Leutnant" &&
    schuetzen.some(s => s.rolle === "Leutnant")
) {
    alert("Es darf nur einen Leutnant geben.");
    return;
}
    if (!name) return;

    schuetzen.push({
        id: Date.now(),
        name: name,
        rolle: rolle,
        aktiv: true
    });

    speichern();
    appAktualisieren();

    document.getElementById("neuerSchuetze").value = "";
}

function schuetzeLoeschen(index) {
    if (!confirm("Schützen wirklich löschen?")) return;

    schuetzen.splice(index, 1);
    speichern();
    appAktualisieren();
}

function strafartHinzufuegen() {
    const bezeichnung = document.getElementById("neueStrafart").value.trim();
    const betrag = Number(document.getElementById("neuerBetrag").value);

    if (!bezeichnung || !betrag) {
        alert("Bitte Strafart und Betrag eingeben.");
        return;
    }

    strafarten.push({
        bezeichnung: bezeichnung,
        betrag: betrag
    });

    document.getElementById("neueStrafart").value = "";
    document.getElementById("neuerBetrag").value = "";

    speichern();
    appAktualisieren();
}

function strafartLoeschen(index) {
    if (!confirm("Strafart wirklich löschen?")) return;

    strafarten.splice(index, 1);
    speichern();
    appAktualisieren();
}

function betragAktualisieren() {
    const index = document.getElementById("strafartSelect").value;

    if (index === "") return;

    document.getElementById("betrag").value = strafarten[index].betrag;
}

function strafeSpeichern() {
    const schuetzeIndex = document.getElementById("schuetzeSelect").value;
    const strafartIndex = document.getElementById("strafartSelect").value;
    const betrag = Number(document.getElementById("betrag").value);

    const kommentar = document.getElementById("kommentar").value.trim();

    if (schuetzeIndex === "" || strafartIndex === "" || !betrag) {
        alert("Bitte Schütze, Strafart und Betrag auswählen.");
        return;
    }
 const schuetze = schuetzen[schuetzeIndex];

let endbetrag = betrag;

if (
    schuetze.rolle === "Spieß" ||
    schuetze.rolle === "Oberleutnant" ||
    schuetze.rolle === "Leutnant"
) {
    endbetrag = betrag * 2;
}
   strafen.push({
    schuetze: schuetzen[schuetzeIndex].name,
    strafart: strafarten[strafartIndex].bezeichnung,
    basisbetrag: betrag,
    betrag: endbetrag,
    kommentar: kommentar,
    datum: new Date().toLocaleDateString("de-DE")
});

    document.getElementById("kommentar").value = "";
   
    document.getElementById("betrag").value = "";

    speichern();
    appAktualisieren();
}

function appAktualisieren() {
    document.getElementById("zugnameAnzeige").innerText = zugname;

    const logoAnzeige = document.getElementById("logoAnzeige");

    if (logo) {
        logoAnzeige.src = logo;
        logoAnzeige.style.display = "block";
    } else {
        logoAnzeige.style.display = "none";
    }

    document.getElementById("adminBereich").classList.toggle("hidden", !istAdmin);
    document.getElementById("strafeBereich").classList.toggle("hidden", !istAdmin);
document.getElementById("anwesenheitBereich").classList.toggle("hidden", !istAdmin);
    document.getElementById("loginStatus").innerText = istAdmin
        ? "Ansicht: Admin"
        : "Ansicht: Schütze";

    const schuetzenListe = document.getElementById("schuetzenListe");
    const strafartenListe = document.getElementById("strafartenListe");
    const schuetzeSelect = document.getElementById("schuetzeSelect");
    const strafartSelect = document.getElementById("strafartSelect");
    const strafenTabelle = document.getElementById("strafenTabelle");
const anwesenheitenTabelle =
document.getElementById("anwesenheitenTabelle");

    schuetzenListe.innerHTML = "";
    strafartenListe.innerHTML = "";
    schuetzeSelect.innerHTML = '<option value="">Schütze auswählen</option>';
    anwesenheitSchuetzeSelect.innerHTML = '<option value="">Schütze auswählen</option>';
    strafartSelect.innerHTML = '<option value="">Strafart auswählen</option>';
    strafenTabelle.innerHTML = "";
    anwesenheitenTabelle.innerHTML = "";

   schuetzen.forEach((schuetze, index) => {
    schuetzenListe.innerHTML += `
        <li>
    <strong>${schuetze.name}</strong>
    <br>
    Rolle: ${schuetze.rolle}
    <br>
    Status: ${schuetze.aktiv ? "Aktiv" : "Inaktiv"}
    <br><br>

    <button onclick="mitgliedBearbeiten(${index})">
        Bearbeiten
    </button>

    <button onclick="mitgliedStatusWechseln(${index})">
        ${schuetze.aktiv ? "Inaktiv setzen" : "Aktiv setzen"}
    </button>

    <button class="delete-button" onclick="schuetzeLoeschen(${index})">
        Löschen
    </button>
</li>
    `;

    schuetzeSelect.innerHTML += `
    <option value="${index}">
        ${schuetze.name}
    </option>
`;

anwesenheitSchuetzeSelect.innerHTML += `
    <option value="${index}">
        ${schuetze.name}
    </option>
`;
});
    strafarten.forEach((strafart, index) => {
        strafartenListe.innerHTML += `
            <li>
                ${strafart.bezeichnung} – ${strafart.betrag} €
                <button class="delete-button" onclick="strafartLoeschen(${index})">Löschen</button>
            </li>
        `;

        strafartSelect.innerHTML += `
            <option value="${index}">
                ${strafart.bezeichnung}
            </option>
        `;
    });

    let gesamt = 0;

anwesenheiten.forEach((anwesenheit, index) => {
    anwesenheitenTabelle.innerHTML += `
        <tr>
            <td>${anwesenheit.tag}</td>
            <td>${anwesenheit.schuetze}</td>
            <td>${anwesenheit.status}</td>
            <td>${anwesenheit.minuten}</td>
            <td>
    <td>
    <button onclick="anwesenheitBearbeiten(${index})">
        Bearbeiten
    </button>

    <button
        class="delete-button"
        onclick="anwesenheitLoeschen(${index})">
        Löschen
    </button>
</td>
        </tr>
    `;

});

 strafen.forEach((strafe, index) => {
    gesamt += strafe.betrag;

    strafenTabelle.innerHTML += `
        <tr>
            <td>${strafe.datum}</td>
            <td>${strafe.schuetze}</td>
            <td>${strafe.strafart}</td>
            <td>${strafe.betrag} €</td>
            <td>${strafe.kommentar || "-"}</td>
            <td>
                <button
                    class="delete-button"
                    onclick="strafeLoeschen(${index})">
                    Löschen
                </button>
            </td>
        </tr>
    `;
});

    document.getElementById("gesamtbetrag").innerText = `Gesamtsumme: ${gesamt} €`;
}
function mitgliedStatusWechseln(index) {

    schuetzen[index].aktiv = !schuetzen[index].aktiv;

    speichern();
    appAktualisieren();
}

function mitgliedBearbeiten(index) {

    const neuerName = prompt(
        "Neuer Name:",
        schuetzen[index].name
    );

    if (!neuerName) return;

    schuetzen[index].name = neuerName;

    speichern();
    appAktualisieren();
}

function strafeLoeschen(index) {

    if (!confirm("Strafe wirklich löschen?")) {
        return;
    }

    strafen.splice(index, 1);

    speichern();
    appAktualisieren();
}

function anwesenheitSpeichern() {
    const tag = document.getElementById("tagSelect").value;
    const schuetzeIndex = document.getElementById("anwesenheitSchuetzeSelect").value;
    const status = document.getElementById("statusSelect").value;
    const minuten = Number(document.getElementById("verspaetungMinuten").value) || 0;

    if (schuetzeIndex === "") {
        alert("Bitte einen Schützen auswählen.");
        return;
    }
    const bereitsVorhanden = anwesenheiten.some(anwesenheit =>
    anwesenheit.tag === tag &&
    anwesenheit.schuetzeId === schuetzen[schuetzeIndex].id
);

if (bereitsVorhanden) {
    alert("Für diesen Schützen wurde an diesem Tag bereits eine Anwesenheit erfasst.");
    return;
}

    anwesenheiten.push({
        id: Date.now(),
        tag: tag,
        schuetzeId: schuetzen[schuetzeIndex].id,
        schuetze: schuetzen[schuetzeIndex].name,
        status: status,
        minuten: minuten
    });

   if (status === "Zu spät") {

    const passendeStrafart = strafarten.find(strafart =>
        strafart.bezeichnung.toLowerCase().includes("zu spät")
    );

    if (passendeStrafart) {
        automatischeStrafeErstellen(passendeStrafart, schuetzeIndex, tag, `${minuten} Minuten verspätet`);
    }
} 


    document.getElementById("verspaetungMinuten").value = "";

    speichern();
    appAktualisieren();
}

function automatischeStrafeErstellen(strafart, schuetzeIndex, tag, kommentar) {

    const schuetze = schuetzen[schuetzeIndex];

    let endbetrag = strafart.betrag;

    if (
        schuetze.rolle === "Spieß" ||
        schuetze.rolle === "Oberleutnant" ||
        schuetze.rolle === "Leutnant"
    ) {
        endbetrag = strafart.betrag * 2;
    }

    strafen.push({
        schuetze: schuetze.name,
        strafart: strafart.bezeichnung,
        basisbetrag: strafart.betrag,
        betrag: endbetrag,
        kommentar: kommentar,
        datum: new Date().toLocaleDateString("de-DE")
    });
}
function anwesenheitLoeschen(index) {

    if (!confirm("Anwesenheit wirklich löschen?")) {
        return;
    }

    anwesenheiten.splice(index, 1);

    speichern();
    appAktualisieren();
}
function anwesenheitBearbeiten(index) {

    const neuerStatus = prompt(
        "Neuer Status (Anwesend, Zu spät, Entschuldigt, Fehlend):",
        anwesenheiten[index].status
    );

    if (!neuerStatus) return;

    anwesenheiten[index].status = neuerStatus;

    speichern();
    appAktualisieren();
}
appAktualisieren();