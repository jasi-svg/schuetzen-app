const ADMIN_CODE = "spiess2026";

let istAdmin = false;

let zugname = localStorage.getItem("zugname") || "Digitaler Strafenkatalog";
let logo = localStorage.getItem("logo") || "";

let schuetzen = JSON.parse(localStorage.getItem("schuetzen")) || [];
let strafarten = JSON.parse(localStorage.getItem("strafarten")) || [];
let strafen = JSON.parse(localStorage.getItem("strafen")) || [];

function speichern() {
    localStorage.setItem("zugname", zugname);
    localStorage.setItem("logo", logo);
    localStorage.setItem("schuetzen", JSON.stringify(schuetzen));
    localStorage.setItem("strafarten", JSON.stringify(strafarten));
    localStorage.setItem("strafen", JSON.stringify(strafen));
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

    strafen.push({
      schuetze: schuetzen[schuetzeIndex].name,
        strafart: strafarten[strafartIndex].bezeichnung,
        betrag: betrag,
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

    document.getElementById("loginStatus").innerText = istAdmin
        ? "Ansicht: Admin"
        : "Ansicht: Schütze";

    const schuetzenListe = document.getElementById("schuetzenListe");
    const strafartenListe = document.getElementById("strafartenListe");
    const schuetzeSelect = document.getElementById("schuetzeSelect");
    const strafartSelect = document.getElementById("strafartSelect");
    const strafenTabelle = document.getElementById("strafenTabelle");

    schuetzenListe.innerHTML = "";
    strafartenListe.innerHTML = "";
    schuetzeSelect.innerHTML = '<option value="">Schütze auswählen</option>';
    strafartSelect.innerHTML = '<option value="">Strafart auswählen</option>';
    strafenTabelle.innerHTML = "";

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

    strafen.forEach(strafe => {
        gesamt += strafe.betrag;

        strafenTabelle.innerHTML += `
            <tr>
                <td>${strafe.datum}</td>
                <td>${strafe.schuetze}</td>
                <td>${strafe.strafart}</td>
                <td>${strafe.betrag} €</td>
                <td>${strafe.kommentar || "-"}</td>
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
appAktualisieren();