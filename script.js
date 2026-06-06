let aktuellerBenutzer = JSON.parse(localStorage.getItem("aktuellerBenutzer")) || null;

let zugname = localStorage.getItem("zugname") || "Digitaler Strafenkatalog";
let logo = localStorage.getItem("logo") || "";

let schuetzen = JSON.parse(localStorage.getItem("schuetzen")) || [];
let strafarten = JSON.parse(localStorage.getItem("strafarten")) || [];
let strafen = JSON.parse(localStorage.getItem("strafen")) || [];
let anwesenheiten = JSON.parse(localStorage.getItem("anwesenheiten")) || [];

function speichern() {
    localStorage.setItem("aktuellerBenutzer", JSON.stringify(aktuellerBenutzer));
    localStorage.setItem("zugname", zugname);
    localStorage.setItem("logo", logo);
    localStorage.setItem("schuetzen", JSON.stringify(schuetzen));
    localStorage.setItem("strafarten", JSON.stringify(strafarten));
    localStorage.setItem("strafen", JSON.stringify(strafen));
    localStorage.setItem("anwesenheiten", JSON.stringify(anwesenheiten));
}

function istOffizier(schuetze) {
    return (
        schuetze.rolle === "Spieß" ||
        schuetze.rolle === "Oberleutnant" ||
        schuetze.rolle === "Leutnant"
    );
}

function darfBearbeiten() {
    if (!aktuellerBenutzer) return false;

    return (
        aktuellerBenutzer.rolle === "Spieß" ||
        aktuellerBenutzer.rolle === "Oberleutnant" ||
        aktuellerBenutzer.rolle === "Leutnant"
    );
}

function berechneEndbetrag(basisbetrag, schuetze) {
    return istOffizier(schuetze) ? basisbetrag * 2 : basisbetrag;
}

function datenMigration() {
    schuetzen = schuetzen.map(schuetze => {
        if (typeof schuetze === "string") {
            return {
                id: Date.now() + Math.random(),
                name: schuetze,
                rolle: "Schütze",
                aktiv: true,
                bild: "",
                benutzername: schuetze.toLowerCase().replaceAll(" ", "."),
                passwort: "1234"
            };
        }

        return {
            id: schuetze.id || Date.now() + Math.random(),
            name: schuetze.name || "Unbekannt",
            rolle: schuetze.rolle || "Schütze",
            aktiv: schuetze.aktiv !== false,
            bild: schuetze.bild || "",
            benutzername:
                schuetze.benutzername ||
                (schuetze.name || "unbekannt").toLowerCase().replaceAll(" ", "."),
            passwort: schuetze.passwort || "1234"
        };
    });

    strafen = strafen.map(strafe => {
        return {
            id: strafe.id || Date.now() + Math.random(),
            schuetzeId: strafe.schuetzeId || null,
            schuetze: strafe.schuetze || "Unbekannt",
            strafart: strafe.strafart || "Unbekannt",
            basisbetrag: strafe.basisbetrag || strafe.betrag || 0,
            betrag: strafe.betrag || 0,
            kommentar: strafe.kommentar || "",
            datum: strafe.datum || new Date().toLocaleDateString("de-DE"),
            bezahlt: strafe.bezahlt === true
        };
    });

    anwesenheiten = anwesenheiten.map(anwesenheit => {
        return {
            id: anwesenheit.id || Date.now() + Math.random(),
            tag: anwesenheit.tag || "Freitag",
            schuetzeId: anwesenheit.schuetzeId || null,
            schuetze: anwesenheit.schuetze || "Unbekannt",
            status: anwesenheit.status || "Anwesend",
            minuten: Number(anwesenheit.minuten) || 0
        };
    });

    speichern();
}

function einloggen() {
    const benutzername = document.getElementById("loginName").value.trim();
    const passwort = document.getElementById("loginPasswort").value;

    const benutzer = schuetzen.find(schuetze =>
        schuetze.benutzername === benutzername &&
        schuetze.passwort === passwort &&
        schuetze.aktiv
    );

    if (!benutzer) {
        alert("Login fehlgeschlagen. Bitte Benutzername und Passwort prüfen.");
        return;
    }

    aktuellerBenutzer = {
        id: benutzer.id,
        name: benutzer.name,
        rolle: benutzer.rolle
    };

    document.getElementById("loginName").value = "";
    document.getElementById("loginPasswort").value = "";

    speichern();
    appAktualisieren();
}

function ausloggen() {
    aktuellerBenutzer = null;

    speichern();
    appAktualisieren();
}
function zugnameSpeichern() {
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Einstellungen ändern.");
        return;
    }

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
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Einstellungen ändern.");
        return;
    }

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
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Mitglieder hinzufügen.");
        return;
    }

    const name = document.getElementById("neuerSchuetze").value.trim();
    const benutzername = document.getElementById("benutzernameInput").value.trim();
    const passwort = document.getElementById("passwortInput").value;
    const rolle = document.getElementById("rolleSelect").value;

    if (!name || !benutzername || !passwort) {
        alert("Bitte Name, Benutzername und Passwort eingeben.");
        return;
    }

    if (schuetzen.some(s => s.benutzername === benutzername)) {
        alert("Dieser Benutzername ist bereits vergeben.");
        return;
    }

    if (rolle === "Spieß" && schuetzen.some(s => s.rolle === "Spieß")) {
        alert("Es darf nur einen Spieß geben.");
        return;
    }

    if (rolle === "Oberleutnant" && schuetzen.some(s => s.rolle === "Oberleutnant")) {
        alert("Es darf nur einen Oberleutnant geben.");
        return;
    }

    if (rolle === "Leutnant" && schuetzen.some(s => s.rolle === "Leutnant")) {
        alert("Es darf nur einen Leutnant geben.");
        return;
    }

    schuetzen.push({
        id: Date.now(),
        name: name,
        rolle: rolle,
        aktiv: true,
        bild: "",
        benutzername: benutzername,
        passwort: passwort
    });

    document.getElementById("neuerSchuetze").value = "";
    document.getElementById("benutzernameInput").value = "";
    document.getElementById("passwortInput").value = "";

    speichern();
    appAktualisieren();
}

function schuetzeLoeschen(index) {
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Mitglieder löschen.");
        return;
    }

    if (!confirm("Schützen wirklich löschen?")) return;

    schuetzen.splice(index, 1);

    speichern();
    appAktualisieren();
}

function mitgliedStatusWechseln(index) {
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Mitglieder ändern.");
        return;
    }

    schuetzen[index].aktiv = !schuetzen[index].aktiv;

    speichern();
    appAktualisieren();
}

function mitgliedBearbeiten(index) {
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Mitglieder bearbeiten.");
        return;
    }

    const neuerName = prompt("Neuer Name:", schuetzen[index].name);

    if (!neuerName) return;

    schuetzen[index].name = neuerName.trim();

    speichern();
    appAktualisieren();
}

function profilbildHochladen(index) {
    const darfEigenesBildAendern =
        aktuellerBenutzer &&
        aktuellerBenutzer.id === schuetzen[index].id;

    if (!darfBearbeiten() && !darfEigenesBildAendern) {
        alert("Du darfst nur dein eigenes Profilbild ändern.");
        return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = function() {
        const datei = input.files[0];

        if (!datei) return;

        const reader = new FileReader();

        reader.onload = function() {
            schuetzen[index].bild = reader.result;

            speichern();
            appAktualisieren();
        };

        reader.readAsDataURL(datei);
    };

    input.click();
}

function strafartHinzufuegen() {
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Strafarten hinzufügen.");
        return;
    }

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
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Strafarten löschen.");
        return;
    }

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
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Strafen erfassen.");
        return;
    }

    const schuetzeIndex = document.getElementById("schuetzeSelect").value;
    const strafartIndex = document.getElementById("strafartSelect").value;
    const basisbetrag = Number(document.getElementById("betrag").value);
    const kommentar = document.getElementById("kommentar").value.trim();

    if (schuetzeIndex === "" || strafartIndex === "" || !basisbetrag) {
        alert("Bitte Schütze, Strafart und Betrag auswählen.");
        return;
    }

    const schuetze = schuetzen[schuetzeIndex];
    const strafart = strafarten[strafartIndex];
    const endbetrag = berechneEndbetrag(basisbetrag, schuetze);

    strafen.push({
        id: Date.now(),
        schuetzeId: schuetze.id,
        schuetze: schuetze.name,
        strafart: strafart.bezeichnung,
        basisbetrag: basisbetrag,
        betrag: endbetrag,
        kommentar: kommentar,
        datum: new Date().toLocaleDateString("de-DE"),
        bezahlt: false
    });

    document.getElementById("kommentar").value = "";
    document.getElementById("betrag").value = "";

    speichern();
    appAktualisieren();
}

function automatischeStrafeErstellen(strafart, schuetzeIndex, tag, kommentar) {
    const schuetze = schuetzen[schuetzeIndex];
    const endbetrag = berechneEndbetrag(strafart.betrag, schuetze);

    strafen.push({
        id: Date.now(),
        schuetzeId: schuetze.id,
        schuetze: schuetze.name,
        strafart: strafart.bezeichnung,
        basisbetrag: strafart.betrag,
        betrag: endbetrag,
        kommentar: kommentar,
        datum: new Date().toLocaleDateString("de-DE"),
        bezahlt: false
    });
}

function strafeLoeschen(index) {
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Strafen löschen.");
        return;
    }

    if (!confirm("Strafe wirklich löschen?")) return;

    strafen.splice(index, 1);

    speichern();
    appAktualisieren();
}

function bezahlstatusWechseln(index) {
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Zahlungen markieren.");
        return;
    }

    strafen[index].bezahlt = !strafen[index].bezahlt;

    speichern();
    appAktualisieren();
}

function anwesenheitSpeichern() {
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Anwesenheiten erfassen.");
        return;
    }

    const tag = document.getElementById("tagSelect").value;
    const schuetzeIndex = document.getElementById("anwesenheitSchuetzeSelect").value;
    const status = document.getElementById("statusSelect").value;
    const minuten = Number(document.getElementById("verspaetungMinuten").value) || 0;

    if (schuetzeIndex === "") {
        alert("Bitte einen Schützen auswählen.");
        return;
    }

    const schuetze = schuetzen[schuetzeIndex];

    const bereitsVorhanden = anwesenheiten.some(anwesenheit =>
        anwesenheit.tag === tag &&
        anwesenheit.schuetzeId === schuetze.id
    );

    if (bereitsVorhanden) {
        alert("Für diesen Schützen wurde an diesem Tag bereits eine Anwesenheit erfasst.");
        return;
    }

    anwesenheiten.push({
        id: Date.now(),
        tag: tag,
        schuetzeId: schuetze.id,
        schuetze: schuetze.name,
        status: status,
        minuten: minuten
    });

    if (status === "Zu spät") {
        const passendeStrafart = strafarten.find(strafart =>
            strafart.bezeichnung.toLowerCase().includes("zu spät")
        );

        if (passendeStrafart) {
            automatischeStrafeErstellen(
                passendeStrafart,
                schuetzeIndex,
                tag,
                `${minuten} Minuten verspätet`
            );
        }
    }

    document.getElementById("verspaetungMinuten").value = "";

    speichern();
    appAktualisieren();
}

function anwesenheitLoeschen(index) {
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Anwesenheiten löschen.");
        return;
    }

    if (!confirm("Anwesenheit wirklich löschen?")) return;

    anwesenheiten.splice(index, 1);

    speichern();
    appAktualisieren();
}

function anwesenheitBearbeiten(index) {
    if (!darfBearbeiten()) {
        alert("Nur Offiziere dürfen Anwesenheiten bearbeiten.");
        return;
    }

    const neuerStatus = prompt(
        "Neuer Status (Anwesend, Zu spät, Entschuldigt, Fehlend):",
        anwesenheiten[index].status
    );

    if (!neuerStatus) return;

    const neueMinuten = prompt(
        "Verspätung in Minuten:",
        anwesenheiten[index].minuten
    );

    anwesenheiten[index].status = neuerStatus;
    anwesenheiten[index].minuten = Number(neueMinuten) || 0;

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

    const istEingeloggt = aktuellerBenutzer !== null;
    const istBearbeiter = darfBearbeiten();

document.getElementById("mitgliederSeite").classList.toggle("hidden", !istBearbeiter);
document.getElementById("strafenSeite").classList.toggle("hidden", !istBearbeiter);
document.getElementById("anwesenheitSeite").classList.toggle("hidden", !istBearbeiter);

    document.getElementById("loginStatus").innerText = istEingeloggt
        ? `Eingeloggt als: ${aktuellerBenutzer.name} (${aktuellerBenutzer.rolle})`
        : "Nicht eingeloggt";

    const schuetzenListe = document.getElementById("schuetzenListe");
    const strafartenListe = document.getElementById("strafartenListe");
    const schuetzeSelect = document.getElementById("schuetzeSelect");
    const strafartSelect = document.getElementById("strafartSelect");
    const strafenTabelle = document.getElementById("strafenTabelle");
    const anwesenheitSchuetzeSelect = document.getElementById("anwesenheitSchuetzeSelect");
    const anwesenheitenTabelle = document.getElementById("anwesenheitenTabelle");
    const statistikTabelle = document.getElementById("statistikTabelle");

    const dashboardGesamt = document.getElementById("dashboardGesamt");
    const profilInhalt =
    document.getElementById("profilInhalt");
    const dashboardBezahlt = document.getElementById("dashboardBezahlt");
    const dashboardOffen = document.getElementById("dashboardOffen");
    const dashboardAnzahlStrafen = document.getElementById("dashboardAnzahlStrafen");
    const dashboardAnwesenheiten = document.getElementById("dashboardAnwesenheiten");
    const zugsauTabelle = document.getElementById("zugsauTabelle");
    const schuldenTabelle = document.getElementById("schuldenTabelle");

    schuetzenListe.innerHTML = "";
    strafartenListe.innerHTML = "";
    schuetzeSelect.innerHTML = '<option value="">Schütze auswählen</option>';
    anwesenheitSchuetzeSelect.innerHTML = '<option value="">Schütze auswählen</option>';
    strafartSelect.innerHTML = '<option value="">Strafart auswählen</option>';
    strafenTabelle.innerHTML = "";
    anwesenheitenTabelle.innerHTML = "";
    statistikTabelle.innerHTML = "";
    zugsauTabelle.innerHTML = "";
    schuldenTabelle.innerHTML = "";

    schuetzen.forEach((schuetze, index) => {
        const darfProfilbildAendern =
            istBearbeiter ||
            (aktuellerBenutzer && aktuellerBenutzer.id === schuetze.id);

        schuetzenListe.innerHTML += `
            <li>
                ${
                    schuetze.bild
                    ? `<img src="${schuetze.bild}" class="profilbild">`
                    : ""
                }

                <strong>${schuetze.name}</strong>
                <br>
                Rolle: ${schuetze.rolle}
                <br>
                Benutzername: ${schuetze.benutzername}
                <br>
                Status: ${schuetze.aktiv ? "Aktiv" : "Inaktiv"}
                <br><br>

                ${
                    darfProfilbildAendern
                    ? `<button onclick="profilbildHochladen(${index})">Profilbild</button>`
                    : ""
                }

                ${
                    istBearbeiter
                    ? `
                        <button onclick="mitgliedBearbeiten(${index})">
                            Bearbeiten
                        </button>

<button onclick="schuetzenakteAnzeigen(${index})">
    Akte
</button>

                        <button onclick="mitgliedStatusWechseln(${index})">
                            ${schuetze.aktiv ? "Deaktivieren" : "Aktivieren"}
                        </button>

                        <button class="delete-button" onclick="schuetzeLoeschen(${index})">
                            Löschen
                        </button>
                    `
                    : ""
                }
            </li>
        `;

        if (schuetze.aktiv) {
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
        }
    });

    strafarten.forEach((strafart, index) => {
        strafartenListe.innerHTML += `
            <li>
                ${strafart.bezeichnung} – ${strafart.betrag} €
                ${
                    istBearbeiter
                    ? `<button class="delete-button" onclick="strafartLoeschen(${index})">Löschen</button>`
                    : ""
                }
            </li>
        `;

        strafartSelect.innerHTML += `
            <option value="${index}">
                ${strafart.bezeichnung}
            </option>
        `;
    });

    anwesenheiten.forEach((anwesenheit, index) => {
        anwesenheitenTabelle.innerHTML += `
            <tr>
                <td>${anwesenheit.tag}</td>
                <td>${anwesenheit.schuetze}</td>
                <td>${anwesenheit.status}</td>
                <td>${anwesenheit.minuten}</td>
                <td>
                    ${
                        istBearbeiter
                        ? `
                            <button onclick="anwesenheitBearbeiten(${index})">
                                Bearbeiten
                            </button>

                            <button class="delete-button" onclick="anwesenheitLoeschen(${index})">
                                Löschen
                            </button>
                        `
                        : "-"
                    }
                </td>
            </tr>
        `;
    });

    schuetzen.forEach(schuetze => {
        const anwesend = anwesenheiten.filter(
            a => a.schuetzeId === schuetze.id && a.status === "Anwesend"
        ).length;

        const zuSpaet = anwesenheiten.filter(
            a => a.schuetzeId === schuetze.id && a.status === "Zu spät"
        ).length;

        const entschuldigt = anwesenheiten.filter(
            a => a.schuetzeId === schuetze.id && a.status === "Entschuldigt"
        ).length;

        const fehlend = anwesenheiten.filter(
            a => a.schuetzeId === schuetze.id && a.status === "Fehlend"
        ).length;
const letzteStrafen = strafen
    .filter(s => s.schuetzeId === aktuellerBenutzer.id)
    .slice(-5)
    .reverse();
        statistikTabelle.innerHTML += `
            <tr>
                <td>${schuetze.name}</td>
                <td>${anwesend}</td>
                <td>${zuSpaet}</td>
                <td>${entschuldigt}</td>
                <td>${fehlend}</td>
            </tr>
        `;
    });

    let gesamt = 0;

    strafen.forEach((strafe, index) => {
        if (strafe.bezahlt === undefined) {
            strafe.bezahlt = false;
        }

        gesamt += strafe.betrag;

        strafenTabelle.innerHTML += `
            <tr>
                <td>${strafe.datum}</td>
                <td>${strafe.schuetze}</td>
                <td>${strafe.strafart}</td>
                <td>${strafe.betrag} €</td>
                <td>${strafe.kommentar || "-"}</td>
<td class="${
    strafe.bezahlt
        ? "status-bezahlt"
        : "status-offen"
}">
    ${strafe.bezahlt ? "Bezahlt" : "Offen"}
</td>
                    ${
                        istBearbeiter
                        ? `
                            <button onclick="bezahlstatusWechseln(${index})">
                                ${strafe.bezahlt ? "Auf offen setzen" : "Als bezahlt markieren"}
                            </button>

                            <button class="delete-button" onclick="strafeLoeschen(${index})">
                                Löschen
                            </button>
                        `
                        : "-"
                    }
                </td>
            </tr>
        `;
    });

    const bezahltSumme = strafen
        .filter(strafe => strafe.bezahlt)
        .reduce((sum, strafe) => sum + strafe.betrag, 0);

    const offenSumme = strafen
        .filter(strafe => !strafe.bezahlt)
        .reduce((sum, strafe) => sum + strafe.betrag, 0);

    document.getElementById("gesamtbetrag").innerText = `Gesamtsumme: ${gesamt} €`;

    dashboardGesamt.innerText = `${gesamt} €`;
    dashboardBezahlt.innerText = `${bezahltSumme} €`;
    dashboardOffen.innerText = `${offenSumme} €`;
    dashboardAnzahlStrafen.innerText = strafen.length;
    dashboardAnwesenheiten.innerText = anwesenheiten.length;
    if (!aktuellerBenutzer) {

    profilInhalt.innerHTML = `
        Bitte einloggen.
    `;

} else {

    const eigenerSchuetze = schuetzen.find(
        s => s.id === aktuellerBenutzer.id
    );

    const gesamtStrafen = strafen
        .filter(s => s.schuetzeId === aktuellerBenutzer.id)
        .reduce((sum, s) => sum + s.betrag, 0);

    const offeneStrafen = strafen
        .filter(
            s =>
                s.schuetzeId === aktuellerBenutzer.id &&
                !s.bezahlt
        )
        .reduce((sum, s) => sum + s.betrag, 0);

    const anwesend = anwesenheiten.filter(
        a =>
            a.schuetzeId === aktuellerBenutzer.id &&
            a.status === "Anwesend"
    ).length;

    const zuSpaet = anwesenheiten.filter(
        a =>
            a.schuetzeId === aktuellerBenutzer.id &&
            a.status === "Zu spät"
    ).length;

    const fehlend = anwesenheiten.filter(
        a =>
            a.schuetzeId === aktuellerBenutzer.id &&
            a.status === "Fehlend"
    ).length;

const letzteStrafen = strafen
    .filter(s => s.schuetzeId === aktuellerBenutzer.id)
    .slice(-5)
    .reverse();

    profilInhalt.innerHTML = `
        ${
            eigenerSchuetze?.bild
                ? `<img src="${eigenerSchuetze.bild}" class="profilbild">`
                : ""
        }

        <p><strong>Name:</strong> ${aktuellerBenutzer.name}</p>

        <p><strong>Rolle:</strong> ${aktuellerBenutzer.rolle}</p>

        <p><strong>Strafen gesamt:</strong> ${gesamtStrafen} €</p>

        <p><strong>Offen:</strong> ${offeneStrafen} €</p>

        <p><strong>Anwesend:</strong> ${anwesend}</p>

        <p><strong>Zu spät:</strong> ${zuSpaet}</p>

<p><strong>Fehlend:</strong> ${fehlend}</p>

<h3>Letzte Strafen</h3>

<ul>
    ${
        letzteStrafen.length > 0
            ? letzteStrafen.map(strafe => `
                <li>
                    ${strafe.strafart} |
                    ${strafe.betrag} € |
                    ${strafe.bezahlt ? "Bezahlt" : "Offen"}
                </li>
            `).join("")
            : "<li>Keine Strafen vorhanden.</li>"
    }
</ul>
`;
}

    const ranking = [];

    schuetzen.forEach(schuetze => {
        const summe = strafen
            .filter(strafe => strafe.schuetze === schuetze.name)
            .reduce((sum, strafe) => sum + strafe.betrag, 0);

        if (summe > 0) {
            ranking.push({
                name: schuetze.name,
                summe: summe
            });
        }
    });

    ranking.sort((a, b) => b.summe - a.summe);

    ranking.forEach((eintrag, index) => {
        zugsauTabelle.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${eintrag.name}</td>
                <td>${eintrag.summe} €</td>
            </tr>
        `;
    });

    const schulden = [];

    schuetzen.forEach(schuetze => {
        const offen = strafen
            .filter(strafe =>
                strafe.schuetze === schuetze.name &&
                !strafe.bezahlt
            )
            .reduce((sum, strafe) => sum + strafe.betrag, 0);

        if (offen > 0) {
            schulden.push({
                name: schuetze.name,
                offen: offen
            });
        }
    });

    schulden.sort((a, b) => b.offen - a.offen);

    schulden.forEach(eintrag => {
        schuldenTabelle.innerHTML += `
            <tr>
                <td>${eintrag.name}</td>
                <td>${eintrag.offen} €</td>
            </tr>
        `;
    });

    speichern();
}
function schuetzenakteAnzeigen(index) {
    const schuetze = schuetzen[index];

    const schuetzenakteBereich = document.getElementById("aktenSeite");
    const schuetzenakteInhalt = document.getElementById("schuetzenakteInhalt");

    const strafenDesSchuetzen = strafen.filter(
        strafe => strafe.schuetze === schuetze.name
    );

    const anwesenheitenDesSchuetzen = anwesenheiten.filter(
        anwesenheit => anwesenheit.schuetzeId === schuetze.id
    );

    const gesamt = strafenDesSchuetzen.reduce(
        (sum, strafe) => sum + strafe.betrag,
        0
    );

    const offen = strafenDesSchuetzen
        .filter(strafe => !strafe.bezahlt)
        .reduce((sum, strafe) => sum + strafe.betrag, 0);

    const bezahlt = strafenDesSchuetzen
        .filter(strafe => strafe.bezahlt)
        .reduce((sum, strafe) => sum + strafe.betrag, 0);

    const anwesend = anwesenheitenDesSchuetzen.filter(
        a => a.status === "Anwesend"
    ).length;

    const zuSpaet = anwesenheitenDesSchuetzen.filter(
        a => a.status === "Zu spät"
    ).length;

    const entschuldigt = anwesenheitenDesSchuetzen.filter(
        a => a.status === "Entschuldigt"
    ).length;

    const fehlend = anwesenheitenDesSchuetzen.filter(
        a => a.status === "Fehlend"
    ).length;

    schuetzenakteInhalt.innerHTML = `
        ${
            schuetze.bild
                ? `<img src="${schuetze.bild}" class="profilbild">`
                : ""
        }

        <h3>${schuetze.name}</h3>

        <p><strong>Rolle:</strong> ${schuetze.rolle}</p>
        <p><strong>Status:</strong> ${schuetze.aktiv ? "Aktiv" : "Inaktiv"}</p>

        <h3>Finanzen</h3>
        <p><strong>Gesamt:</strong> ${gesamt} €</p>
        <p><strong>Bezahlt:</strong> ${bezahlt} €</p>
        <p><strong>Offen:</strong> ${offen} €</p>

        <h3>Anwesenheit</h3>
        <p><strong>Anwesend:</strong> ${anwesend}</p>
        <p><strong>Zu spät:</strong> ${zuSpaet}</p>
        <p><strong>Entschuldigt:</strong> ${entschuldigt}</p>
        <p><strong>Fehlend:</strong> ${fehlend}</p>

<h3>Strafhistorie</h3>

<table>
    <thead>
        <tr>
            <th>Datum</th>
            <th>Strafe</th>
            <th>Betrag</th>
            <th>Status</th>
        </tr>
    </thead>

    <tbody>
        ${
            strafenDesSchuetzen.length > 0
                ? strafenDesSchuetzen.map(strafe => `
                    <tr>
                        <td>${strafe.datum}</td>
                        <td>${strafe.strafart}</td>
                        <td>${strafe.betrag} €</td>
                        <td>${strafe.bezahlt ? "Bezahlt" : "Offen"}</td>
                    </tr>
                `).join("")
                : `
                    <tr>
                        <td colspan="4">
                            Keine Strafen vorhanden
                        </td>
                    </tr>
                `
        }
    </tbody>
</table>

      <h3>Anwesenheitshistorie</h3>

<table>
    <thead>
        <tr>
            <th>Tag</th>
            <th>Status</th>
            <th>Minuten</th>
        </tr>
    </thead>

    <tbody>
        ${
            anwesenheitenDesSchuetzen.length > 0
                ? anwesenheitenDesSchuetzen.map(anwesenheit => `
                    <tr>
                        <td>${anwesenheit.tag}</td>
<td class="${
    anwesenheit.status === "Anwesend"
        ? "status-anwesend"
        : anwesenheit.status === "Zu spät"
        ? "status-zuspaet"
        : anwesenheit.status === "Entschuldigt"
        ? "status-entschuldigt"
        : "status-fehlend"
}">
    ${anwesenheit.status}
</td>
                        <td>${anwesenheit.minuten}</td>
                    </tr>
                `).join("")
                : `
                    <tr>
                        <td colspan="3">
                            Keine Anwesenheiten vorhanden
                        </td>
                    </tr>
                `
        }
    </tbody>
</table>
    `;

    schuetzenakteBereich.classList.remove("hidden");

    schuetzenakteBereich.scrollIntoView({
        behavior: "smooth"
    });
}
function seiteAnzeigen(seite) {

    document
        .querySelectorAll(".app-seite")
        .forEach(element => {
            element.classList.add("hidden");
        });

    if (seite === "dashboard") {
        document
            .getElementById("dashboardSeite")
            .classList.remove("hidden");
    }

    if (seite === "mitglieder") {
        document
            .getElementById("mitgliederSeite")
            .classList.remove("hidden");
    }

    if (seite === "strafen") {
        document
            .getElementById("strafenSeite")
            .classList.remove("hidden");
    }

    if (seite === "anwesenheit") {
        document
            .getElementById("anwesenheitSeite")
            .classList.remove("hidden");
    }

    if (seite === "akten") {
        document
            .getElementById("aktenSeite")
            .classList.remove("hidden");
    }
}
datenMigration();
appAktualisieren();

seiteAnzeigen("dashboard");