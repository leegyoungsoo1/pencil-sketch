"""Keep the largest connected alpha component in every cell of a sprite sheet."""
from collections import deque
from pathlib import Path
from PIL import Image
import sys


def clean(source: Path, destination: Path, columns: int = 4, rows: int = 4) -> None:
    image = Image.open(source).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    removed = 0
    for row in range(rows):
        top, bottom = round(row * height / rows), round((row + 1) * height / rows)
        for column in range(columns):
            left, right = round(column * width / columns), round((column + 1) * width / columns)
            active = {(x, y) for y in range(top, bottom) for x in range(left, right) if pixels[x, y][3] > 3}
            components = []
            while active:
                start = active.pop()
                component = {start}
                queue = deque([start])
                while queue:
                    x, y = queue.popleft()
                    for nx in range(max(left, x - 1), min(right, x + 2)):
                        for ny in range(max(top, y - 1), min(bottom, y + 2)):
                            point = (nx, ny)
                            if point in active:
                                active.remove(point)
                                component.add(point)
                                queue.append(point)
                components.append(component)
            keep = max(components, key=len) if components else set()
            for y in range(top, bottom):
                for x in range(left, right):
                    if (x, y) not in keep and pixels[x, y][3]:
                        pixels[x, y] = (0, 0, 0, 0)
                        removed += 1
    image.save(destination, optimize=True)
    print(f"{destination}: removed {removed:,} stray pixels")


if __name__ == "__main__":
    clean(Path(sys.argv[1]), Path(sys.argv[2]))
