// Lógica del Panel de Seguimiento (Kanban).
(function () {
  const ESTADOS = ["Solicitudes", "En Proceso", "Completado"];

  const COLORES_FAMILIA = {
    "Operaciones": "badge-operaciones",
    "Administración": "badge-administracion",
    "Gerencia": "badge-gerencia"
  };

  function normalizarEstado(estado) {
    if (!estado) return "Solicitudes";
    if (estado === "Pendiente" || estado === "Solicitado") return "Solicitudes";
    return ESTADOS.indexOf(estado) !== -1 ? estado : "Solicitudes";
  }

  function formatearFecha(iso) {
    if (!iso) return "Sin fecha";
    const fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return "Sin fecha";
    return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function crearBadge(familia) {
    const clase = COLORES_FAMILIA[familia] || "badge-default";
    return '<span class="badge ' + clase + '">' + (familia || "Sin familia") + "</span>";
  }

  var modal = document.getElementById("carpetaModal");
  var modalTitulo = document.getElementById("carpetaModalTitulo");
  var modalBody = document.getElementById("carpetaModalBody");

  function abrirModal(titulo, contenido) {
    modalTitulo.textContent = titulo;
    modalBody.innerHTML = "";
    modalBody.appendChild(contenido);
    modal.hidden = false;
  }

  function cerrarModal() {
    modal.hidden = true;
    modalBody.innerHTML = "";
  }

  document.getElementById("carpetaModalCerrar").addEventListener("click", cerrarModal);
  document.getElementById("carpetaModalCerrarX").addEventListener("click", cerrarModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) cerrarModal();
  });

  function crearCargandoCarpeta() {
    const contenedor = document.createElement("div");
    contenedor.className = "loader-view";
    const spinner = document.createElement("div");
    spinner.className = "spinner";
    const texto = document.createElement("p");
    texto.textContent = "Creando carpeta y seleccionando plantillas...";
    contenedor.appendChild(spinner);
    contenedor.appendChild(texto);
    return contenedor;
  }

  function crearFilaArchivo(tipo, nombre) {
    const fila = document.createElement("div");
    fila.className = "file-row";
    const etiqueta = document.createElement("span");
    etiqueta.className = "file-type file-" + tipo;
    etiqueta.textContent = tipo === "pdf" ? "PDF" : tipo === "xlsx" ? "XLSX" : "DOCX";
    const nombreSpan = document.createElement("span");
    nombreSpan.className = "file-name";
    nombreSpan.textContent = nombre;
    fila.appendChild(etiqueta);
    fila.appendChild(nombreSpan);
    return fila;
  }

  function crearContenidoCarpeta(solicitud) {
    const contenedor = document.createElement("div");
    contenedor.className = "file-explorer";

    const carpeta = document.createElement("div");
    carpeta.className = "file-folder";
    const etiqueta = document.createElement("span");
    etiqueta.className = "file-type file-carpeta";
    etiqueta.textContent = "CARPETA";
    const nombre = document.createElement("span");
    nombre.className = "file-folder-nombre";
    nombre.textContent = solicitud.nombre;
    carpeta.appendChild(etiqueta);
    carpeta.appendChild(nombre);

    const items = document.createElement("div");
    items.className = "file-items";
    items.appendChild(crearFilaArchivo("pdf", "CV_" + solicitud.nombre + ".pdf"));
    items.appendChild(crearFilaArchivo("xlsx", "Informe_Psicolaboral_" + solicitud.familia + ".xlsx"));
    items.appendChild(crearFilaArchivo("docx", "Pauta_Entrevista_" + solicitud.familia + ".docx"));

    const nota = document.createElement("p");
    nota.className = "file-nota";
    nota.textContent = "Plantillas seleccionadas automáticamente según la familia de cargo.";

    contenedor.appendChild(carpeta);
    contenedor.appendChild(items);
    contenedor.appendChild(nota);
    return contenedor;
  }

  function prepararCarpeta(solicitud) {
    abrirModal("Preparando Carpeta", crearCargandoCarpeta());
    setTimeout(function () {
      marcarCarpetaPreparada(solicitud.id);
      renderizar();
      abrirModal("Carpeta Preparada", crearContenidoCarpeta(solicitud));
    }, 1500);
  }

  function verCarpeta(solicitud) {
    abrirModal("Carpeta Preparada", crearContenidoCarpeta(solicitud));
  }

  function crearTarjeta(solicitud, estado) {
    const card = document.createElement("div");
    card.className = "kanban-card";
    card.dataset.id = solicitud.id;
    card.draggable = true;

    const header = document.createElement("div");
    header.className = "kanban-card-header";
    header.innerHTML =
      '<span class="kanban-card-nombre">' + solicitud.nombre + "</span>" +
      crearBadge(solicitud.familia);

    const cargo = document.createElement("div");
    cargo.className = "kanban-card-cargo";
    cargo.textContent = solicitud.cargo || "—";

    const fecha = document.createElement("div");
    fecha.className = "kanban-card-fecha";
    fecha.textContent = "Solicitada el " + formatearFecha(solicitud.creadaEn);

    card.appendChild(header);
    card.appendChild(cargo);
    card.appendChild(fecha);

    if (estado === "Solicitudes" || estado === "En Proceso") {
      const btnCarpeta = document.createElement("button");
      btnCarpeta.type = "button";
      btnCarpeta.draggable = false;
      if (solicitud.carpetaPreparada) {
        btnCarpeta.className = "btn btn-carpeta btn-carpeta-ver";
        btnCarpeta.textContent = "Ver Carpeta";
        btnCarpeta.addEventListener("click", function () {
          verCarpeta(solicitud);
        });
      } else {
        btnCarpeta.className = "btn btn-carpeta";
        btnCarpeta.textContent = "Preparar Carpeta";
        btnCarpeta.addEventListener("click", function () {
          prepararCarpeta(solicitud);
        });
      }
      card.appendChild(btnCarpeta);
    }

    const footer = document.createElement("div");
    footer.className = "kanban-card-footer";

    const indice = ESTADOS.indexOf(estado);
    if (indice < ESTADOS.length - 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-avanzar";
      btn.draggable = false;
      btn.textContent = "Avanzar >";
      btn.addEventListener("click", function () {
        const siguiente = ESTADOS[indice + 1];
        actualizarEstado(solicitud.id, siguiente);
        renderizar();
      });
      footer.appendChild(btn);
    }

    const btnEliminar = document.createElement("button");
    btnEliminar.type = "button";
    btnEliminar.className = "btn btn-eliminar";
    btnEliminar.draggable = false;
    btnEliminar.textContent = "Eliminar";
    btnEliminar.addEventListener("click", function () {
      if (window.confirm("¿Eliminar la solicitud de " + solicitud.nombre + "?")) {
        eliminarSolicitud(solicitud.id);
        renderizar();
      }
    });
    footer.appendChild(btnEliminar);

    card.appendChild(footer);
    return card;
  }

  function configurarTablero() {
    const tablero = document.getElementById("kanban");

    tablero.addEventListener("dragstart", function (e) {
      const card = e.target.closest(".kanban-card");
      if (!card) return;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(card.dataset.id));
      card.classList.add("dragging");
    });

    tablero.addEventListener("dragend", function () {
      document.querySelectorAll(".kanban-card").forEach(function (c) {
        c.classList.remove("dragging");
      });
      document.querySelectorAll(".kanban-column").forEach(function (c) {
        c.classList.remove("drag-over");
      });
    });

    tablero.addEventListener("dragover", function (e) {
      const columna = e.target.closest(".kanban-column");
      if (!columna) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      document.querySelectorAll(".kanban-column").forEach(function (c) {
        c.classList.remove("drag-over");
      });
      columna.classList.add("drag-over");
    });

    tablero.addEventListener("dragleave", function (e) {
      const columna = e.target.closest(".kanban-column");
      if (columna && (!e.relatedTarget || !columna.contains(e.relatedTarget))) {
        columna.classList.remove("drag-over");
      }
    });

    tablero.addEventListener("drop", function (e) {
      const columna = e.target.closest(".kanban-column");
      if (!columna) return;
      e.preventDefault();
      const id = parseInt(e.dataTransfer.getData("text/plain"), 10);
      const estado = columna.dataset.estado;
      if (!isNaN(id) && estado) {
        actualizarEstado(id, estado);
        renderizar();
      }
    });
  }

  function renderizar() {
    const lista = leerSolicitudes();

    const tablero = document.getElementById("kanban");
    if (!lista.length) {
      tablero.hidden = true;
      return;
    }
    tablero.hidden = false;

    const contadores = {};
    ESTADOS.forEach(function (e) {
      contadores[e] = 0;
    });

    document.querySelectorAll(".kanban-cards").forEach(function (contenedor) {
      contenedor.innerHTML = "";
    });

    lista.forEach(function (solicitud) {
      const estado = normalizarEstado(solicitud.estado);
      const columna = document.querySelector(
        '.kanban-column[data-estado="' + estado + '"]'
      );
      if (columna) {
        columna.querySelector(".kanban-cards").appendChild(crearTarjeta(solicitud, estado));
        contadores[estado] += 1;
      }
    });

    ESTADOS.forEach(function (e) {
      const contador = document.querySelector('[data-count="' + e + '"]');
      if (contador) contador.textContent = contadores[e];
    });
  }

  configurarTablero();
  renderizar();

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("anio").textContent = new Date().getFullYear();
  });
})();