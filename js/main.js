// Lógica de la interfaz: formulario de solicitud de evaluación psicolaboral.
(function () {
  const form = document.getElementById("solicitudForm");
  const btnLimpiar = document.getElementById("btnLimpiar");
  const toast = document.getElementById("toast");

  const campos = {
    nombre: { input: document.getElementById("nombre"), error: document.getElementById("error-nombre") },
    familia: { input: document.getElementById("familia"), error: document.getElementById("error-familia") },
    cargo: { input: document.getElementById("cargo"), error: document.getElementById("error-cargo") },
    cv: { input: document.getElementById("cv"), error: document.getElementById("error-cv") }
  };

  function limpiarErrores() {
    Object.values(campos).forEach(function (c) {
      c.input.classList.remove("invalid");
      c.error.textContent = "";
    });
  }

  function marcarError(nombre, mensaje) {
    const c = campos[nombre];
    c.input.classList.add("invalid");
    c.error.textContent = mensaje;
  }

  function validarFormulario() {
    let valido = true;

    const nombre = campos.nombre.input.value.trim();
    if (!nombre) {
      marcarError("nombre", "Ingrese el nombre del candidato.");
      valido = false;
    }

    const familia = campos.familia.input.value;
    if (!familia) {
      marcarError("familia", "Seleccione una familia de cargo.");
      valido = false;
    }

    const cargo = campos.cargo.input.value.trim();
    if (!cargo) {
      marcarError("cargo", "Ingrese el nombre del cargo.");
      valido = false;
    }

    if (!campos.cv.input.files || campos.cv.input.files.length === 0) {
      marcarError("cv", "Adjunte el CV del candidato.");
      valido = false;
    }

    return valido;
  }

  function mostrarToast(mensaje, tipo) {
    toast.textContent = mensaje;
    toast.className = "toast " + tipo;
    toast.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.hidden = true;
    }, 4000);
  }

  function limpiarFormulario() {
    form.reset();
    limpiarErrores();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    limpiarErrores();

    if (!validarFormulario()) {
      mostrarToast("Revise los campos resaltados.", "error");
      return;
    }

    const archivo = campos.cv.input.files[0];
    guardarSolicitud({
      nombre: campos.nombre.input.value.trim(),
      familia: campos.familia.input.value,
      cargo: campos.cargo.input.value.trim(),
      cv: archivo ? archivo.name : null
    });

    limpiarFormulario();
    mostrarToast("Solicitud enviada correctamente", "success");
  });

  btnLimpiar.addEventListener("click", limpiarFormulario);

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("anio").textContent = new Date().getFullYear();
  });
})();