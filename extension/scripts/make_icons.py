import math
from PIL import Image, ImageDraw, ImageFilter

MASTER = 1024
CX = CY = MASTER / 2
CONTENT_MARGIN_RATIO = 16 / 128  # Chrome Web Store: 16px transparent pad around 96x96 in a 128 canvas
R = MASTER / 2 * (1 - CONTENT_MARGIN_RATIO)  # usable content radius

# Palette
BODY_GREEN = (46, 163, 108, 255)
BODY_GREEN_DARK = (28, 116, 76, 255)
CRUST = (222, 168, 86, 255)
CRUST_LINE = (196, 138, 64, 255)
CHEESE = (250, 210, 112, 255)
PEPPERONI = (193, 64, 42, 255)
PEPPERONI_DARK = (150, 44, 30, 255)
WHITE = (255, 255, 255, 255)
BLACK = (30, 30, 30, 255)
TRANSPARENT = (0, 0, 0, 0)

def polar(dist, angle_deg):
    a = math.radians(angle_deg)
    return (CX + dist * math.cos(a), CY + dist * math.sin(a))

def ellipse_at(draw, center, radius_x, radius_y, fill):
    cx, cy = center
    draw.ellipse([cx - radius_x, cy - radius_y, cx + radius_x, cy + radius_y], fill=fill)

def circle_at(draw, center, radius, fill):
    ellipse_at(draw, center, radius, radius, fill)

def make_master():
    img = Image.new("RGBA", (MASTER, MASTER), TRANSPARENT)
    d = ImageDraw.Draw(img)

    shell_r = R * 0.56

    # legs: small, mostly tucked under the shell -- just the toe-tips peek out
    leg_r = shell_r * 0.27
    leg_dist = shell_r * 0.90

    # tail: a small nub at the back
    tail_r = shell_r * 0.16
    tail_dist = shell_r * 0.92

    # head: the face, clearly visible below the shell
    head_r = shell_r * 0.50
    head_dist = shell_r * 1.02

    for angle in (-135, -45, 45, 135):
        ellipse_at(d, polar(leg_dist, angle), leg_r, leg_r * 0.85, BODY_GREEN)

    ellipse_at(d, polar(tail_dist, -90), tail_r, tail_r, BODY_GREEN)

    head_center = polar(head_dist, 90)
    ellipse_at(d, head_center, head_r, head_r, BODY_GREEN)

    # face, placed in the lower (visibly protruding) part of the head
    eye_r = head_r * 0.20
    eye_dx = head_r * 0.38
    eye_dy = head_r * 0.18
    pupil_r = eye_r * 0.52
    for sign in (-1, 1):
        ex = head_center[0] + sign * eye_dx
        ey = head_center[1] + eye_dy
        ellipse_at(d, (ex, ey), eye_r, eye_r, WHITE)
        ellipse_at(d, (ex + sign * eye_r * 0.15, ey + eye_r * 0.2), pupil_r, pupil_r, BLACK)

    mouth_cy = head_center[1] + head_r * 0.52
    d.arc(
        [head_center[0] - head_r * 0.32, mouth_cy - head_r * 0.22,
         head_center[0] + head_r * 0.32, mouth_cy + head_r * 0.22],
        start=15, end=165, fill=BODY_GREEN_DARK, width=max(2, int(head_r * 0.09)),
    )

    # --- shell ("pizza") drawn last so it overlaps the body parts ---
    circle_at(d, (CX, CY), shell_r, CRUST)
    circle_at(d, (CX, CY), shell_r - shell_r * 0.16, CHEESE)

    # faint slice lines (mostly a large-size detail; blends away at small sizes)
    inner_r = shell_r * 0.20
    for angle in (20, 100, 200, 280):
        p1 = polar(inner_r, angle)
        p2 = polar(shell_r - shell_r * 0.16, angle)
        d.line([p1, p2], fill=CRUST_LINE, width=max(2, int(shell_r * 0.03)))

    for angle, dist_ratio in ((25, 0.44), (155, 0.5), (255, 0.4)):
        p = polar(shell_r * dist_ratio, angle)
        pep_r = shell_r * 0.115
        circle_at(d, p, pep_r, PEPPERONI)
        circle_at(d, (p[0] - pep_r * 0.2, p[1] - pep_r * 0.2), pep_r * 0.28, PEPPERONI_DARK)

    # a bite taken out of the shell, clear of the legs (which sit at +-45/+-135)
    bite_center = polar(shell_r, 0)
    circle_at(d, bite_center, shell_r * 0.38, TRANSPARENT)

    return img

def add_halo(img, grow=15):
    alpha = img.split()[-1]
    grown = alpha.filter(ImageFilter.MaxFilter(grow if grow % 2 == 1 else grow + 1))
    grown = grown.filter(ImageFilter.GaussianBlur(grow * 0.35))
    white_halo = Image.new("RGBA", img.size, WHITE)
    white_halo.putalpha(grown)
    base = Image.new("RGBA", img.size, TRANSPARENT)
    base = Image.alpha_composite(base, white_halo)
    base = Image.alpha_composite(base, img)
    return base

def main():
    import os
    master = make_master()
    final_master = add_halo(master)

    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "icons"))
    os.makedirs(out_dir, exist_ok=True)

    for size in (128, 48, 32, 16):
        resized = final_master.resize((size, size), Image.LANCZOS)
        resized.save(os.path.join(out_dir, f"icon{size}.png"))

    preview_dir = os.path.join(os.path.dirname(__file__), "_preview")
    os.makedirs(preview_dir, exist_ok=True)
    final_master.resize((512, 512), Image.LANCZOS).save(os.path.join(preview_dir, "icon_preview_512.png"))
    # also a no-halo, no-downscale look at the raw silhouette for review
    master.resize((512, 512), Image.LANCZOS).save(os.path.join(preview_dir, "icon_preview_nohalo_512.png"))

    print("done:", out_dir)

if __name__ == "__main__":
    main()
