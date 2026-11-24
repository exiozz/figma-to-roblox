-- FigmaRoblox : importe dans Studio ce qui a été envoyé à l'application locale
--   • « Importer depuis Figma »         → le dernier design Figma, en ScreenGui
--   • « Importer modèles et images »    → les modèles 3D (Blender, dossier) et images (dossier)
local HttpService = game:GetService("HttpService")
local InsertService = game:GetService("InsertService")
local StarterGui = game:GetService("StarterGui")
local Selection = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

local BRIDGE = "http://localhost:7777"

-- Polices Figma → familles Roblox les plus proches.
local FAMILIES = {
	Inter = "BuilderSans",
	Roboto = "Roboto",
	Montserrat = "Montserrat",
	Poppins = "BuilderSans",
	["Gotham"] = "GothamSSm",
	["Source Sans Pro"] = "SourceSansPro",
	Nunito = "Nunito",
	Oswald = "Oswald",
	["Fredoka One"] = "FredokaOne",
	["Luckiest Guy"] = "LuckiestGuy",
}

local WEIGHTS = {
	Thin = Enum.FontWeight.Thin,
	["Extra Light"] = Enum.FontWeight.ExtraLight,
	Light = Enum.FontWeight.Light,
	Regular = Enum.FontWeight.Regular,
	Medium = Enum.FontWeight.Medium,
	["Semi Bold"] = Enum.FontWeight.SemiBold,
	Bold = Enum.FontWeight.Bold,
	["Extra Bold"] = Enum.FontWeight.ExtraBold,
	Black = Enum.FontWeight.Heavy,
}

local ALIGN_X = { LEFT = Enum.TextXAlignment.Left, CENTER = Enum.TextXAlignment.Center, RIGHT = Enum.TextXAlignment.Right, JUSTIFIED = Enum.TextXAlignment.Left }
local ALIGN_Y = { TOP = Enum.TextYAlignment.Top, CENTER = Enum.TextYAlignment.Center, BOTTOM = Enum.TextYAlignment.Bottom }

local function color(c)
	return Color3.fromRGB(c[1], c[2], c[3])
end

-- Roblox exige des séquences qui commencent à 0 et finissent à 1.
local function keypoints(list, make)
	local points = {}
	for _, s in ipairs(list) do
		table.insert(points, make(math.clamp(s.p, 0, 1), s))
	end
	table.sort(points, function(a, b) return a.Time < b.Time end)
	if points[1].Time > 0 then
		table.insert(points, 1, make(0, list[1]))
	end
	if points[#points].Time < 1 then
		table.insert(points, make(1, list[#list]))
	end
	return points
end

local function addGradient(gui, g)
	local grad = Instance.new("UIGradient")
	grad.Rotation = g.rotation
	grad.Color = ColorSequence.new(keypoints(g.colors, function(t, s)
		return ColorSequenceKeypoint.new(t, color(s.c))
	end))
	grad.Transparency = NumberSequence.new(keypoints(g.transparency, function(t, s)
		return NumberSequenceKeypoint.new(t, math.clamp(s.t, 0, 1))
	end))
	grad.Parent = gui
end

local function addStroke(gui, s, isText)
	local stroke = Instance.new("UIStroke")
	stroke.Color = color(s.color)
	stroke.Transparency = math.clamp(s.transparency, 0, 1)
	stroke.Thickness = s.thickness
	stroke.ApplyStrokeMode = isText and Enum.ApplyStrokeMode.Contextual or Enum.ApplyStrokeMode.Border
	stroke.Parent = gui
end

local function build(node)
	local gui
	if node.kind == "image" then
		gui = Instance.new("ImageLabel")
		gui.Image = node.image
		gui.ScaleType = Enum.ScaleType.Stretch
		gui.BackgroundTransparency = 1
	elseif node.kind == "text" then
		local t = node.text
		gui = Instance.new("TextLabel")
		gui.Text = t.content
		gui.TextSize = t.size
		gui.TextColor3 = color(t.color)
		gui.TextTransparency = math.clamp(t.transparency, 0, 1)
		gui.TextXAlignment = ALIGN_X[t.alignX] or Enum.TextXAlignment.Left
		gui.TextYAlignment = ALIGN_Y[t.alignY] or Enum.TextYAlignment.Top
		gui.TextWrapped = t.wrap
		gui.BackgroundTransparency = 1
		local family = FAMILIES[t.family] or "BuilderSans"
		gui.FontFace = Font.new(
			"rbxasset://fonts/families/" .. family .. ".json",
			WEIGHTS[t.style:gsub(" Italic", "")] or Enum.FontWeight.Regular,
			t.style:find("Italic") and Enum.FontStyle.Italic or Enum.FontStyle.Normal
		)
	else
		gui = Instance.new("Frame")
		gui.BorderSizePixel = 0
		gui.ClipsDescendants = node.clip
		if node.bg then
			gui.BackgroundColor3 = color(node.bg.color)
			gui.BackgroundTransparency = math.clamp(node.bg.transparency, 0, 1)
		else
			gui.BackgroundTransparency = 1
		end
		if node.gradient then
			addGradient(gui, node.gradient)
		end
		if node.corner then
			local corner = Instance.new("UICorner")
			corner.CornerRadius = UDim.new(0, node.corner)
			corner.Parent = gui
		end
	end

	gui.Name = node.name
	gui.Position = UDim2.fromOffset(node.x, node.y)
	gui.Size = UDim2.fromOffset(node.w, node.h)
	gui.ZIndex = node.z
	if node.stroke then
		addStroke(gui, node.stroke, node.kind == "text")
	end
	for _, child in ipairs(node.children or {}) do
		build(child).Parent = gui
	end
	return gui
end

local function fetch(route)
	local ok, body = pcall(HttpService.GetAsync, HttpService, BRIDGE .. route, true)
	if not ok then
		warn("[FigmaRoblox] Application injoignable : lance FigmaRoblox.exe. Détail : " .. tostring(body))
		return nil
	end
	return HttpService:JSONDecode(body)
end

local function withUndo(name, fn)
	local recording = ChangeHistoryService:TryBeginRecording(name)
	fn()
	if recording then
		ChangeHistoryService:FinishRecording(recording, Enum.FinishRecordingOperation.Commit)
	end
end

local function import()
	local data = fetch("/latest")
	if not data then
		return
	end
	if not data.tree then
		warn("[Figma] Rien à importer : envoie d'abord un frame depuis le plugin Figma.")
		return
	end

	withUndo("Importer depuis Figma", function()
		local screen = Instance.new("ScreenGui")
		screen.Name = data.name
		screen.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
		screen.ResetOnSpawn = false

		local root = build(data.tree)
		-- Racine centrée en haut de l'écran ; à repositionner librement ensuite.
		root.AnchorPoint = Vector2.new(0.5, 0)
		root.Position = UDim2.new(0.5, 0, 0, 20)
		root.Parent = screen
		screen.Parent = StarterGui
		Selection:Set({ root })
	end)
	print(("[FigmaRoblox] « %s » importé (v%d) dans StarterGui."):format(data.name, data.version))
end

-- Modèles et images : on n'importe que ce qui est arrivé depuis le dernier import.
local LAST_ID_SETTING = "LastImportedAssetId"

-- Point devant la caméra, posé sur ce qu'elle regarde (sol, décor) si possible.
local function dropPoint()
	local cam = workspace.CurrentCamera
	local origin = cam.CFrame.Position
	local hit = workspace:Raycast(origin, cam.CFrame.LookVector * 200)
	return hit and hit.Position or (origin + cam.CFrame.LookVector * 20)
end

local function insertModel(asset)
	local ok, container = pcall(InsertService.LoadAsset, InsertService, tonumber(asset.assetId))
	if not ok then
		warn(("[FigmaRoblox] Modèle « %s » (%s) pas encore disponible : %s"):format(asset.name, asset.assetId, tostring(container)))
		return nil
	end
	-- LoadAsset renvoie un conteneur : on garde son contenu, regroupé dans un Model au nom de l'asset.
	local model = Instance.new("Model")
	model.Name = asset.name
	for _, child in ipairs(container:GetChildren()) do
		child.Parent = model
	end
	container:Destroy()
	-- Posé sur le point visé, le bas du modèle au niveau du sol.
	local cf, size = model:GetBoundingBox()
	local target = dropPoint()
	model:PivotTo(model:GetPivot() + (target - cf.Position) + Vector3.new(0, size.Y / 2, 0))
	model.Parent = workspace
	return model
end

local function insertImage(asset)
	local screen = StarterGui:FindFirstChild("Images importées")
	if not screen then
		screen = Instance.new("ScreenGui")
		screen.Name = "Images importées"
		screen.Enabled = false -- visible dans l'éditeur seulement en l'activant ; sert de réserve d'images
		screen.Parent = StarterGui
		local grid = Instance.new("UIGridLayout")
		grid.CellSize = UDim2.fromOffset(160, 160)
		grid.Parent = screen
	end
	local label = Instance.new("ImageLabel")
	label.Name = asset.name
	label.Image = "rbxassetid://" .. asset.assetId
	label.ScaleType = Enum.ScaleType.Fit
	label.BackgroundTransparency = 1
	label.Parent = screen
	return label
end

local function importAssets()
	local after = plugin:GetSetting(LAST_ID_SETTING) or 0
	local data = fetch("/assets?after=" .. after)
	if not data then
		return
	end
	if #data.assets == 0 then
		print("[FigmaRoblox] Rien de nouveau : envoie un modèle depuis Blender ou dépose un fichier dans le dossier d'envoi.")
		return
	end

	local created = {}
	local blocked = false
	withUndo("Importer modèles et images", function()
		for _, asset in ipairs(data.assets) do
			local inst = asset.kind == "model" and insertModel(asset) or insertImage(asset)
			if inst then
				table.insert(created, inst)
				print(("[FigmaRoblox] %s « %s » importé (rbxassetid://%s)."):format(
					asset.kind == "model" and "Modèle" or "Image", asset.name, asset.assetId))
			else
				blocked = true -- on le retentera au prochain clic
			end
			if not blocked then
				after = asset.id
			end
		end
	end)
	plugin:SetSetting(LAST_ID_SETTING, after)
	Selection:Set(created)
end

local toolbar = plugin:CreateToolbar("FigmaRoblox")
local figmaButton = toolbar:CreateButton("Importer depuis Figma", "Importe le dernier frame envoyé depuis Figma", "rbxassetid://4458901886")
figmaButton.ClickableWhenViewportHidden = true
figmaButton.Click:Connect(import)

local assetsButton = toolbar:CreateButton("Importer modèles et images", "Importe les modèles (Blender, dossier) et images arrivés depuis le dernier import", "rbxassetid://4458901886")
assetsButton.ClickableWhenViewportHidden = true
assetsButton.Click:Connect(importAssets)
