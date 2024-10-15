import {
  Scene,
  Vector3,
  SceneLoader,
  AbstractMesh,
  StandardMaterial,
  MeshBuilder,
  Texture,
  Material,
  ActionManager,
  ExecuteCodeAction,
  GizmoManager,
  Color3,
  PointerDragBehavior,
} from "@babylonjs/core";
import "@babylonjs/loaders";

type MeshTypes = "2D" | "gltf";

type GizmoStateTypes = "position" | "scale" | "rotation" | "none";

class BabylonMeshes {
  constructor(
    private scene: Scene,
    private meshes: {
      "2D": { [mesh: string]: AbstractMesh };
      "3D": { [mesh: string]: AbstractMesh | AbstractMesh[] };
    }
  ) {}

  loader = async (
    type: MeshTypes,
    meshName: string,
    meshPath: string,
    meshFile: string,
    position?: [number, number, number],
    scale?: [number, number, number],
    rotation?: [number, number, number]
  ) => {
    if (type === "gltf") {
      await this.loadGLTF(meshName, meshPath, meshFile); // Wait for the mesh to load
      const newMesh = this.meshes["3D"][meshName];

      // Check if the mesh is loaded
      if (newMesh) {
        if (newMesh instanceof Array) {
          this.applyMeshAttributes(newMesh[0], position, scale, rotation);
          for (const mesh of newMesh) {
            this.applyMeshActions(type, mesh, newMesh[0]);
          }
        } else {
          this.applyMeshAttributes(newMesh, position, scale, rotation);
          this.applyMeshActions(type, newMesh);
        }
      } else {
        console.error(`Mesh ${meshName} not found after loading.`);
      }
    }
    if (type === "2D") {
      await this.load2D(meshName, meshPath, meshFile); // Wait for the mesh to load
      const newMesh = this.meshes["2D"][meshName];

      // Check if the mesh is loaded
      if (newMesh) {
        this.applyMeshAttributes(newMesh, position, scale, rotation);
        this.applyMeshActions(type, newMesh);
      } else {
        console.error(`Mesh ${meshName} not found after loading.`);
      }
    }
  };

  private applyMeshAttributes = (
    mesh: AbstractMesh,
    position?: [number, number, number],
    scale?: [number, number, number],
    rotation?: [number, number, number]
  ) => {
    if (position) {
      mesh.position = new Vector3(position[0], position[1], position[2]);
    } else {
      mesh.position = new Vector3(0, 0, 0);
    }
    if (scale) {
      mesh.scaling = new Vector3(scale[0], scale[1], scale[2]);
    } else {
      mesh.scaling = new Vector3(1, 1, 1);
    }
    if (rotation) {
      mesh.rotation = new Vector3(rotation[0], rotation[1], rotation[2]);
    } else {
      mesh.rotation = new Vector3(0, 0, 0);
    }
  };

  private applyMeshActions = (
    type: MeshTypes,
    mesh: AbstractMesh,
    parentMesh?: AbstractMesh
  ) => {
    // Initialize dragging state (false by default)
    mesh.metadata = { isGizmoEnabled: false };

    // Handle double-clicks to toggle gizmo
    mesh.actionManager = new ActionManager(this.scene);
    mesh.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnDoublePickTrigger, () => {
        const nextState = this.getNextGizmoState(mesh.metadata.gizmoState);
        mesh.metadata.gizmoState = nextState;

        // Toggle gizmo state
        // If the gizmo is enabled, disable it
        if (parentMesh) {
          this.disableGizmo(parentMesh);
        } else {
          this.disableGizmo(mesh);
        }

        if (nextState !== "none") {
          // Enable gizmo
          if (parentMesh) {
            this.enableGizmo(nextState, type, parentMesh);
          } else {
            this.enableGizmo(nextState, type, mesh);
          }
        }
      })
    );

    mesh.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
        const animationGroups = this.scene.animationGroups;

        // Loop through all animation groups
        animationGroups.forEach((animGroup) => {
          // Check if this animation group targets the clicked mesh
          animGroup.targetedAnimations.forEach((targetedAnim) => {
            animGroup.play(false); // Play the animation group for this mesh
          });
        });
      })
    );
  };

  // Helper function to determine the next gizmo state
  private getNextGizmoState = (
    currentState: GizmoStateTypes
  ): GizmoStateTypes => {
    switch (currentState) {
      case "none":
        return "position";
      case "position":
        return "rotation";
      case "rotation":
        return "scale";
      case "scale":
        return "none";
      default:
        return "none";
    }
  };

  // Function to enable the position gizmo for a mesh
  private enableGizmo = (
    gizmoType: GizmoStateTypes,
    type: MeshTypes,
    mesh: AbstractMesh
  ) => {
    // Create a GizmoManager to manage gizmos in the scene
    const gizmoManager = new GizmoManager(this.scene);

    switch (gizmoType) {
      case "position":
        gizmoManager.positionGizmoEnabled = true;

        const positionGizmo = gizmoManager.gizmos.positionGizmo;
        if (positionGizmo) {
          positionGizmo.xGizmo.coloredMaterial.diffuseColor = new Color3(
            0.96078431,
            0.38039215,
            0.0784313725490196
          ); // Red for X axis
          positionGizmo.yGizmo.coloredMaterial.diffuseColor = new Color3(
            0.17254901,
            0.57254901,
            0.9607843137254902
          ); // Green for Y axis
          positionGizmo.zGizmo.coloredMaterial.diffuseColor = new Color3(
            0.30980392,
            0.6666666666666666,
            0.5333333333333333
          ); // Blue for Z axis
        }

        // Set the gizmo to use world space (fixed axes) instead of local space
        gizmoManager.gizmos.positionGizmo!.updateGizmoRotationToMatchAttachedMesh =
          false;
        gizmoManager.usePointerToAttachGizmos = false; // Disable auto attaching

        // Add dragging behavior along a specific plane (Y-axis constrained)
        let dragBehavior: PointerDragBehavior;
        if (type === "2D") {
          dragBehavior = new PointerDragBehavior({
            dragPlaneNormal: new Vector3(0, 0, 1), // Dragging plane: XZ plane
          });
        } else {
          dragBehavior = new PointerDragBehavior({
            dragPlaneNormal: new Vector3(0, 1, 0), // Dragging plane: XZ plane
          });
        }

        // Attach the drag behavior to the mesh
        mesh.addBehavior(dragBehavior);

        // Store the drag behavior in the mesh's metadata for later access
        mesh.metadata.dragBehavior = dragBehavior;
        break;
      case "rotation":
        gizmoManager.rotationGizmoEnabled = true;

        const rotationGizmo = gizmoManager.gizmos.rotationGizmo;
        if (rotationGizmo) {
          rotationGizmo.xGizmo.coloredMaterial.diffuseColor = new Color3(
            0.96078431,
            0.38039215,
            0.0784313725490196
          ); // Red for X axis
          rotationGizmo.yGizmo.coloredMaterial.diffuseColor = new Color3(
            0.17254901,
            0.57254901,
            0.9607843137254902
          ); // Green for Y axis
          rotationGizmo.zGizmo.coloredMaterial.diffuseColor = new Color3(
            0.30980392,
            0.6666666666666666,
            0.5333333333333333
          ); // Blue for Z axis
        }

        // Set the gizmo to use world space (fixed axes) instead of local space
        gizmoManager.gizmos.rotationGizmo!.updateGizmoRotationToMatchAttachedMesh =
          false;
        gizmoManager.usePointerToAttachGizmos = false; // Disable auto attaching
        break;
      case "scale":
        gizmoManager.scaleGizmoEnabled = true;

        const scaleGizmo = gizmoManager.gizmos.scaleGizmo;
        if (scaleGizmo) {
          scaleGizmo.xGizmo.coloredMaterial.diffuseColor = new Color3(
            0.96078431,
            0.38039215,
            0.0784313725490196
          ); // Red for X axis
          scaleGizmo.yGizmo.coloredMaterial.diffuseColor = new Color3(
            0.17254901,
            0.57254901,
            0.9607843137254902
          ); // Green for Y axis
          scaleGizmo.zGizmo.coloredMaterial.diffuseColor = new Color3(
            0.30980392,
            0.6666666666666666,
            0.5333333333333333
          ); // Blue for Z axis
        }
        break;
    }

    // Attach the gizmo to the selected mesh
    gizmoManager.attachToMesh(mesh);

    // Store the gizmo manager in the mesh's metadata for later access
    mesh.metadata.gizmoManager = gizmoManager;
  };

  // Function to disable the position gizmo for a mesh
  private disableGizmo = (mesh: AbstractMesh) => {
    const gizmoManager = mesh.metadata.gizmoManager;
    if (gizmoManager) {
      // Detach the gizmo from the mesh and disable it
      gizmoManager.attachToMesh(null);
      gizmoManager.dispose(); // Clean up the gizmo manager
    }

    // Remove the drag behavior
    const dragBehavior = mesh.metadata.dragBehavior;
    if (dragBehavior) {
      mesh.removeBehavior(dragBehavior);
    }
  };

  private loadGLTF = (meshName: string, meshPath: string, meshFile: string) => {
    return new Promise<void>((resolve, reject) => {
      // Load the GLTF file
      SceneLoader.ImportMesh(
        meshName,
        meshPath,
        meshFile,
        this.scene,
        (meshes, particleSystems, skeletons, animationGroups) => {
          if (meshes.length > 0) {
            animationGroups.forEach((animationGroup) => {
              animationGroup.pause(); // Pause the animation by default
            });

            const parentMesh = MeshBuilder.CreateBox(
              `${meshName}-parent`,
              { size: 0.1 },
              this.scene
            );
            parentMesh.isVisible = false; // Optionally make the parent mesh invisible
            parentMesh.isPickable = false; // Prevent direct interaction with the parent

            // Set each loaded mesh as a child of the parent
            meshes.forEach((mesh) => {
              mesh.parent = parentMesh; // Set the parent
              mesh.isPickable = true; // Ensure the mesh is pickable
            });

            // Store the parent mesh in the meshes collection
            this.meshes["3D"][meshName] = [parentMesh, ...meshes];
            resolve(); // Resolve the promise when the mesh is loaded
          } else {
            reject(new Error(`No meshes found for ${meshName}`));
          }
        },
        null,
        (scene, message, exception) => {
          console.error(`Error loading mesh: ${message}`, exception);
          reject(exception); // Reject the promise on error
        }
      );
    });
  };

  private load2D = async (
    meshName: string,
    meshPath: string,
    meshFile: string
  ) => {
    return new Promise<void>((resolve) => {
      // Create a plane for the 2D texture
      const plane = MeshBuilder.CreatePlane(
        meshName,
        { width: 1, height: 1 },
        this.scene
      );

      // Create the material with alpha
      const material = new StandardMaterial(`${meshName}-material`, this.scene);

      // Load the texture with transparency
      const texture = new Texture(`${meshPath}${meshFile}`, this.scene);
      texture.hasAlpha = true;

      material.diffuseTexture = texture;

      // Enable alpha blending
      material.useAlphaFromDiffuseTexture = true; // Use the alpha channel from the diffuse texture
      material.transparencyMode = Material.MATERIAL_ALPHABLEND; // Set transparency mode to alpha test

      // Assign material to the plane
      plane.material = material;

      // Store the mesh in the 2D meshes collection
      this.meshes["2D"][meshName] = plane;

      resolve(); // Resolve when the 2D mesh is created
    });
  };
}

export default BabylonMeshes;
