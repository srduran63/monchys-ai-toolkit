"""Quita el fondo de una foto y la guarda como PNG transparente, del mismo tamaño.

Uso: python quitar_fondo.py entrada.jpg salida.png

Sale con código 0 si todo fue bien. Si falla, escribe el motivo en stderr y sale con
1 (imagen que no se puede abrir), 2 (uso incorrecto) o 3 (sin memoria).

Modelo: isnet-general-use (Apache-2.0, apto para uso comercial). No usar el modelo
por defecto de rembg (bria-rmbg): su licencia no permite uso comercial.
Los modelos se guardan en U2NET_HOME (en el servidor se descargan al construir la imagen).
"""
import sys

MODEL = "isnet-general-use"
MAX_SIDE = 4096  # las fotos más grandes se reducen; así la memoria no se dispara


def open_rgb(path):
    from PIL import Image, ImageOps

    img = ImageOps.exif_transpose(Image.open(path))  # respeta la orientación de las fotos del celular
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        white = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(white, img)  # lo que ya era transparente se trata como fondo blanco
    img = img.convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))  # solo reduce, nunca agranda
    return img


def session():
    import onnxruntime as ort
    from rembg import new_session

    # Sin la caché de memoria de onnxruntime: el modelo gasta mucho menos (mismo resultado)
    opts = ort.SessionOptions()
    opts.enable_cpu_mem_arena = False
    opts.enable_mem_pattern = False
    return new_session(MODEL, sess_opts=opts)


def main(argv):
    if len(argv) != 3:
        print("Uso: python quitar_fondo.py entrada.jpg salida.png", file=sys.stderr)
        return 2
    from PIL import UnidentifiedImageError
    from rembg import remove

    try:
        img = open_rgb(argv[1])
    except (FileNotFoundError, UnidentifiedImageError, OSError) as err:
        print(f"No se pudo abrir la imagen: {err}", file=sys.stderr)
        return 1
    try:
        remove(img, session=session()).save(argv[2], format="PNG")
    except MemoryError:
        print("Sin memoria para procesar esta imagen", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
