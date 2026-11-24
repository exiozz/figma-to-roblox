-- Figma → Roblox : importe le dernier design envoyé par le plugin Figma (via le pont local).
local HttpService = game:GetService("HttpService")
local StarterGui = game:GetService("StarterGui")
local Selection = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

local BRIDGE = "http://localhost:7777/latest"

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

-- Open Cloud crée des Decals ; un ImageLabel a besoin de l'image qu'ils contiennent.
local InsertService = game:GetService("InsertService")
local imageCache = plugin:GetSetting("DecalToImage") or {}

local function decalToImage(uri)
	local id = uri:match("%d+")
	if imageCache[id] then
		return imageCache[id]
	end
	local ok, model = pcall(InsertService.LoadAsset, InsertService, tonumber(id))
	if not ok then
		warn("[Figma] Image " .. id .. " pas encore disponible (modération ?) : " .. tostring(model))
		return uri
	end
	local decal = model:FindFirstChildWhichIsA("Decal", true)
	local image = decal and decal.Texture or uri
	model:Destroy()
	imageCache[id] = image
	plugin:SetSetting("DecalToImage", imageCache)
	return image
end

local function resolveImages(node)
	if node.kind == "image" then
		node.image = decalToImage(node.image)
	end
	for _, child in ipairs(node.children or {}) do
		resolveImages(child)
	end
end

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

local function import()
	local ok, body = pcall(HttpService.GetAsync, HttpService, BRIDGE, true)
	if not ok then
		warn("[Figma] Pont local injoignable. Lance « node bridge.js ». Détail : " .. tostring(body))
		return
	end
	local data = HttpService:JSONDecode(body)
	if not data.tree then
		warn("[Figma] Rien à importer : envoie d'abord un frame depuis le plugin Figma.")
		return
	end

	resolveImages(data.tree)

	local recording = ChangeHistoryService:TryBeginRecording("Importer depuis Figma")
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
	if recording then
		ChangeHistoryService:FinishRecording(recording, Enum.FinishRecordingOperation.Commit)
	end
	print(("[Figma] « %s » importé (v%d) dans StarterGui."):format(data.name, data.version))
end

local toolbar = plugin:CreateToolbar("Figma")
local button = toolbar:CreateButton("Importer depuis Figma", "Importe le dernier frame envoyé depuis Figma", "rbxassetid://4458901886")
button.ClickableWhenViewportHidden = true
button.Click:Connect(import)
