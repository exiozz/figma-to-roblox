-- Boussole : défile avec la caméra et indique la direction du spawn.
-- À placer en LocalScript dans le Frame racine importé depuis Figma
-- (StarterGui > Compass Bar (v2) > Compass Bar (v2)).
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local bar = script.Parent
local ticksFrame = bar:WaitForChild("Ticks")
local template = bar:WaitForChild("Heading")
local marker = bar:WaitForChild("Spawn Marker")
local distanceLabel = marker:WaitForChild("Distance")

local WIDTH = bar.Size.X.Offset
local CENTER = WIDTH / 2
local FOV = 180 -- degrés visibles sur toute la largeur
local PX_PER_DEG = WIDTH / FOV
local STUDS_TO_METERS = 0.28

-- Graduations : une tous les 15°, plus grande tous les 45°.
for _, t in ipairs(ticksFrame:GetChildren()) do t:Destroy() end
local ticks = {}
for deg = 0, 345, 15 do
	local major = deg % 45 == 0
	local t = Instance.new("Frame")
	t.BorderSizePixel = 0
	t.BackgroundColor3 = Color3.new(1, 1, 1)
	t.Size = UDim2.fromOffset(1, major and 7 or 4)
	t.Position = UDim2.fromOffset(0, major and 1 or 4)
	t.Parent = ticksFrame
	table.insert(ticks, { gui = t, deg = deg, base = major and 0.1 or 0.45 })
end

-- Points cardinaux, sur le modèle du « W » importé de Figma.
template.Visible = false
local letters = {}
for i, name in ipairs({ "N", "NE", "E", "SE", "S", "SW", "W", "NW" }) do
	local l = template:Clone()
	l.Name = "Cardinal_" .. name
	l.Text = name
	l.Visible = true
	local diagonal = #name == 2
	l.TextSize = diagonal and 10 or template.TextSize
	l.Size = UDim2.fromOffset(30, template.Size.Y.Offset)
	l.Parent = bar
	table.insert(letters, { gui = l, deg = (i - 1) * 45, base = diagonal and 0.35 or 0 })
end

-- Écart signé (−180..180) entre un cap et la direction regardée.
local function offsetFrom(heading, deg)
	return (deg - heading + 540) % 360 - 180
end

local function place(item, heading, centerOffset)
	local off = offsetFrom(heading, item.deg)
	local visible = math.abs(off) < FOV / 2
	item.gui.Visible = visible
	if visible then
		item.gui.Position = UDim2.fromOffset(CENTER + off * PX_PER_DEG - centerOffset, item.gui.Position.Y.Offset)
		local fade = item.base + (1 - item.base) * math.abs(off) / (FOV / 2)
		if item.gui:IsA("TextLabel") then
			item.gui.TextTransparency = fade
		else
			item.gui.BackgroundTransparency = fade
		end
	end
end

-- Cible du marqueur : le SpawnLocation de la map.
local function findSpawn()
	for _, d in ipairs(workspace:GetDescendants()) do
		if d:IsA("SpawnLocation") then return d end
	end
end
-- Avec le streaming, le spawn peut arriver après le script : on le recherche tant qu'il manque.
local spawn

RunService.RenderStepped:Connect(function()
	local cam = workspace.CurrentCamera
	local look = cam.CFrame.LookVector
	-- 0° = nord (−Z), 90° = est (+X).
	local heading = math.deg(math.atan2(look.X, -look.Z)) % 360

	for _, t in ipairs(ticks) do place(t, heading, 0.5) end
	for _, l in ipairs(letters) do place(l, heading, 15) end

	if not (spawn and spawn.Parent) then spawn = findSpawn() end
	marker.Visible = spawn ~= nil
	if spawn then
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		local from = root and root.Position or cam.CFrame.Position
		local delta = spawn.Position - from
		local flat = Vector3.new(delta.X, 0, delta.Z)
		local off = offsetFrom(heading, math.deg(math.atan2(delta.X, -delta.Z)) % 360)
		-- Hors champ : le marqueur reste collé au bord, du bon côté.
		local x = math.clamp(CENTER + off * PX_PER_DEG, 10, WIDTH - 10)
		marker.Position = UDim2.fromOffset(x - marker.Size.X.Offset / 2, marker.Position.Y.Offset)
		distanceLabel.Text = math.floor(flat.Magnitude * STUDS_TO_METERS + 0.5) .. " m"
	end
end)
